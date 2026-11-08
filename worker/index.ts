import { Hono } from "hono";
import { endpoints } from "../shared/endpoints";
import { MAX_BYTES, encoder, error, escapeHtml, headersObject, inspect, intParam, json, origin, queryObject, randomBytes, requestInfo, seconds, sleep, streamed } from "./http";
import { openApi, swagger } from "./openapi";
import { digestAuth } from "./digest";
import { LAST_MODIFIED, ifRangeMatches, preconditionStatus, selectByteRanges } from "./semantics";
import { acceptsEncoding, negotiateImage } from "./negotiation";
import { ACCEPT_QUERY, boundedBody, digestBytes, digestField, matchDigestField, preferMinimal, problem, type DigestAlgorithm } from "./protocol";
import { additionalImageSamples, bmpSample } from "./images";
import { generateUuid, parseUuidVersion } from "./uuid";

export const app = new Hono();

app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("cache-control", "no-store");
  c.res.headers.set("cdn-cache-control", "no-store");
  c.res.headers.set("cloudflare-cdn-cache-control", "no-store");
});

function allowedMethods(path: string): string[] {
  const allowed = new Set<string>(["OPTIONS"]);
  let found = false;
  for (const endpoint of endpoints) {
    const pattern = endpoint.path.split("/").map((segment) =>
      segment.startsWith("{") && segment.endsWith("}") ? "[^/]+" : segment.replace(/[.*+?^$()|[\]\\]/g, "\\$&")
    ).join("/");
    if (new RegExp("^" + pattern + "$").test(path) || (endpoint.path === "/anything" && path.startsWith("/anything/"))) {
      found = true;
      if (endpoint.method === "ANY") {
        for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "QUERY"]) allowed.add(method);
      } else {
        allowed.add(endpoint.method);
        if (endpoint.method === "GET") allowed.add("HEAD");
      }
    }
  }
  if (path === "/response-headers") { found = true; allowed.add("GET"); allowed.add("HEAD"); allowed.add("POST"); }
  if (path.startsWith("/__meta/") || path === "/openapi.json" || path === "/spec.json") {
    found = true; allowed.add("GET"); allowed.add("HEAD");
  }
  return found ? [...allowed] : [];
}

app.options("/*", (c) => {
  const methods = allowedMethods(new URL(c.req.url).pathname);
  if (!methods.length) return error("Endpoint not found.", 404);
  return new Response(null, { status: 204, headers: { "allow": methods.join(", "), "cache-control": "no-store" } });
});

// RFC 10008: a safe, idempotent query fixture, without persistent state.
app.on("QUERY", "/query", async (c) => {
  const headers = { "accept-query": ACCEPT_QUERY };
  const contentType = c.req.header("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!contentType) return problem("QUERY requires a Content-Type field.", 400, headers);
  if (contentType !== "application/json") return problem("Only application/json queries are supported.", 415, headers);
  const accept = c.req.header("accept");
  if (accept && !accept.split(",").some((part) => {
    const [media, ...options] = part.trim().toLowerCase().split(";");
    const quality = options.find((option) => /^\s*q=/.test(option));
    const q = quality ? Number(quality.split("=")[1]) : 1;
    return (media.trim() === "application/json" || media.trim() === "application/*" || media.trim() === "*/*") && Number.isFinite(q) && q > 0 && q <= 1;
  })) return problem("Only application/json query results are available.", 406, headers);
  const body = await boundedBody(c.req.raw);
  if (body instanceof Response) return body;
  let query: unknown;
  try { query = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)); }
  catch { return problem("QUERY content must be valid UTF-8 JSON.", 400, headers); }
  return json({ query }, 200, headers);
});

const DIGEST_BODY = "HTTP content digest fixture\n";
app.on(["GET", "HEAD"], "/digest/generate/:algorithm", async (c) => {
  const algorithm = c.req.param("algorithm").toLowerCase() as DigestAlgorithm;
  if (algorithm !== "sha-256" && algorithm !== "sha-512") return problem("Supported digests: sha-256, sha-512.", 400);
  const content = encoder.encode(DIGEST_BODY);
  const representation = digestField(algorithm, await digestBytes(content, algorithm));
  const transmitted = c.req.method === "HEAD" ? new Uint8Array() : content;
  const contentDigest = digestField(algorithm, await digestBytes(transmitted, algorithm));
  return new Response(c.req.method === "HEAD" ? null : content, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-length": String(content.byteLength),
      "content-digest": contentDigest,
      "repr-digest": representation,
      "cache-control": "no-store",
    },
  });
});

app.post("/digest/verify", async (c) => {
  const field = c.req.header("content-digest");
  if (!field) return problem("A Content-Digest request field is required.", 400);
  const requested = c.req.query("algorithm")?.toLowerCase() || "sha-256";
  if (requested !== "sha-256" && requested !== "sha-512") return problem("Supported digests: sha-256, sha-512.", 400);
  const body = await boundedBody(c.req.raw);
  if (body instanceof Response) return body;
  const result = matchDigestField(field, await digestBytes(body, requested), requested);
  if (result === "invalid") return problem("Content-Digest must be an RFC 9530 structured byte-sequence dictionary containing the selected algorithm.", 400);
  if (result === "mismatch") return problem("Content-Digest does not match the received request content.", 422);
  return json({ verified: true, algorithm: requested, bytes: body.byteLength });
});

// RFC 7240: preferences are advisory; the response acknowledges the applied choice.
app.post("/prefer", async (c) => {
  const body = await boundedBody(c.req.raw);
  if (body instanceof Response) return body;
  const minimal = preferMinimal(c.req.header("prefer") ?? null);
  const headers = { "preference-applied": minimal ? "return=minimal" : "return=representation" };
  if (minimal) return new Response(null, { status: 204, headers });
  return json({ receivedBytes: body.byteLength }, 200, headers);
});

// RFC 6266 and RFC 8187: UTF-8 filename in Content-Disposition.
app.get("/download", (c) => {
  const filename = c.req.query("filename") || "sample.txt";
  if (filename.length > 200 || /[\x00-\x1f\x7f\/\\]/.test(filename) || filename === "." || filename === "..") {
    return problem("Invalid download filename.", 400);
  }
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/[";]/g, "_");
  const disposition = 'attachment; filename="' + fallback + '"; filename*=UTF-8\x27\x27' + encodeURIComponent(filename);
  return new Response("HTTP download fixture\n", {
    headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": disposition, "cache-control": "no-store" },
  });
});

// RFC 9745 and RFC 8594: deprecation is a structured date; Sunset is an HTTP-date.
app.get("/deprecation", () => json({ deprecated: true, replacement: "/get" }, 200, {
  deprecation: "@1735689600",
  sunset: "Sun, 31 Dec 2028 23:59:59 GMT",
  link: '</get>; rel="successor-version"',
}));

// RFC 8288: typed Web Links in the response header.
app.get("/links/header", (c) => {
  const page = intParam(c.req.query("page") || "1", 100, 1);
  if (page === null) return problem("Page must be between 1 and 100.", 400);
  const links = ['</links/header?page=' + Math.min(100, page + 1) + '>; rel="next"'];
  if (page > 1) links.push('</links/header?page=' + (page - 1) + '>; rel="prev"');
  return json({ page }, 200, { link: links.join(", ") });
});

// RFC 9651: a valid Structured Fields Dictionary example.
app.get("/structured-fields", () => json({ field: "example-dictionary" }, 200, {
  "example-dictionary": "count=42, active, updated=@1735689600",
}));

app.get("/openapi.json", (c) => json(openApi(new URL(c.req.url).origin)));
app.get("/spec.json", (c) => json(swagger(new URL(c.req.url).origin)));
app.get("/__meta/endpoints", () => json(endpoints));

app.get("/get", (c) => inspect(c.req.raw));
app.post("/post", (c) => inspect(c.req.raw));
app.put("/put", (c) => inspect(c.req.raw));
app.patch("/patch", (c) => inspect(c.req.raw));
app.delete("/delete", (c) => inspect(c.req.raw));
app.all("/anything", (c) => inspect(c.req.raw));
app.all("/anything/*", (c) => inspect(c.req.raw));
app.get("/ip", (c) => json({ origin: origin(c.req.raw) }));
app.get("/headers", (c) => json({ headers: headersObject(c.req.raw.headers) }));
app.get("/user-agent", (c) => json({ "user-agent": c.req.header("user-agent") || "" }));

function basic(request: Request, user: string, password: string, hidden: boolean): Response {
  const match = /^Basic\s+(\S+)$/i.exec(request.headers.get("authorization") || "");
  let valid = false;
  if (match) {
    try {
      const encoded = atob(match[1]);
      const bytes = Uint8Array.from(encoded, (char) => char.charCodeAt(0));
      const credentials = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const colon = credentials.indexOf(":");
      valid = colon >= 0 && credentials.slice(0, colon) === user && credentials.slice(colon + 1) === password;
    } catch { valid = false; }
  }
  if (valid) return json({ authenticated: true, user });
  if (hidden) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  return new Response(null, { status: 401, headers: { "www-authenticate": 'Basic realm="HTTPBin", charset="UTF-8"', "cache-control": "no-store" } });
}
app.get("/basic-auth/:user/:passwd", (c) => basic(c.req.raw, c.req.param("user"), c.req.param("passwd"), false));
app.get("/hidden-basic-auth/:user/:passwd", (c) => basic(c.req.raw, c.req.param("user"), c.req.param("passwd"), true));
app.get("/digest-auth/:qop/:user/:passwd", (c) => digestAuth(c.req.raw, c.req.param("qop"), c.req.param("user"), c.req.param("passwd")));
app.get("/digest-auth/:qop/:user/:passwd/:algorithm", (c) => digestAuth(c.req.raw, c.req.param("qop"), c.req.param("user"), c.req.param("passwd"), c.req.param("algorithm")));
app.get("/bearer", (c) => {
  const match = /^Bearer\s+(\S+)$/i.exec(c.req.header("authorization") || "");
  return match ? json({ authenticated: true, token: match[1] }) : new Response(null, { status: 401, headers: { "www-authenticate": "Bearer" } });
});

app.on(["GET", "HEAD"], "/status/:codes", (c) => {
  const choices = c.req.param("codes").split(",").map((part) => {
    const [code, weight = "1"] = part.split(":");
    return { status: Number(code), weight: Number(weight) };
  });
  if (!choices.length || choices.some((item) => !Number.isInteger(item.status) || item.status < 100 || item.status > 599 || !Number.isFinite(item.weight) || item.weight <= 0)) {
    return error("Invalid status code or weight.");
  }
  const total = choices.reduce((sum, item) => sum + item.weight, 0);
  let pick = Math.random() * total;
  const choice = choices.find((item) => (pick -= item.weight) < 0) || choices[choices.length - 1];
  if (choice.status < 200) return error("Informational responses are not supported by the Workers Response API.", 501);
  const withoutBody = c.req.method === "HEAD" || [204, 205, 304].includes(choice.status);
  return new Response(withoutBody || choice.status < 400 ? null : "HTTP " + choice.status + "\n", { status: choice.status });
});

app.on(["GET", "HEAD", "POST"], "/response-headers", (c) => {
  const url = new URL(c.req.url);
  const payload = JSON.stringify(queryObject(url), null, 2) + "\n";
  const responseHeaders = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  for (const [key, value] of url.searchParams) {
    if (/^(connection|content-length|content-encoding|transfer-encoding|keep-alive|upgrade|proxy-connection|te|trailer)$/i.test(key)) continue;
    try {
      if (key.toLowerCase() === "set-cookie") responseHeaders.append(key, value);
      else responseHeaders.set(key, value);
    } catch { /* Invalid header names or values are ignored. */ }
  }
  if (!responseHeaders.has("content-type")) responseHeaders.set("content-type", "application/json; charset=utf-8");
  return new Response(c.req.method === "HEAD" ? null : payload, {
    headers: responseHeaders,
  });
});

function redirectChain(request: Request, mode: "normal" | "relative" | "absolute", n: string): Response {
  const count = intParam(n, 20, 1);
  if (count === null || Number(n) > 20) return error("Redirect count must be between 1 and 20.");
  const url = new URL(request.url);
  const path = count === 1 ? "/get" : "/" + (mode === "normal" ? "relative-redirect" : mode + "-redirect") + "/" + (count - 1);
  const destination = mode === "absolute" ? new URL(path, url.origin).href : path;
  return new Response(null, { status: 302, headers: { location: destination } });
}
app.get("/redirect/:n", (c) => redirectChain(c.req.raw, "normal", c.req.param("n")));
app.get("/relative-redirect/:n", (c) => redirectChain(c.req.raw, "relative", c.req.param("n")));
app.get("/absolute-redirect/:n", (c) => redirectChain(c.req.raw, "absolute", c.req.param("n")));
app.get("/redirect-to", (c) => {
  const url = c.req.query("url");
  const code = Number(c.req.query("status_code") || 302);
  if (!url || ![301, 302, 303, 307, 308].includes(code)) return error("A URL and a valid redirect status are required.");
  try {
    const target = new URL(url, c.req.url);
    if (!["http:", "https:"].includes(target.protocol)) return error("Only HTTP and HTTPS redirects are supported.");
    return new Response(null, { status: code, headers: { location: url } });
  } catch { return error("Invalid redirect URL."); }
});

function cookies(request: Request): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    try { result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); }
    catch { result[part.slice(0, index).trim()] = part.slice(index + 1).trim(); }
  }
  return result;
}
app.get("/cookies", (c) => json({ cookies: cookies(c.req.raw) }));
const cookieName = /^[!#$%&'*+\-.^_\x60|~0-9A-Za-z]+$/;

app.get("/cookies/set", (c) => {
  const result = new Response(null, { status: 302, headers: { location: "/cookies", "cache-control": "no-store" } });
  for (const [key, value] of new URL(c.req.url).searchParams) {
    if (!cookieName.test(key)) continue;
    result.headers.append("set-cookie", key + "=" + encodeURIComponent(value) + "; Path=/; SameSite=Lax" + (new URL(c.req.url).protocol === "https:" ? "; Secure" : ""));
  }
  return result;
});
app.get("/cookies/delete", (c) => {
  const result = new Response(null, { status: 302, headers: { location: "/cookies", "cache-control": "no-store" } });
  for (const key of new URL(c.req.url).searchParams.keys()) {
    if (!cookieName.test(key)) continue;
    result.headers.append("set-cookie", key + "=; Path=/; Max-Age=0; SameSite=Lax" + (new URL(c.req.url).protocol === "https:" ? "; Secure" : ""));
  }
  return result;
});

async function uuidResponse(versionValue: string | undefined, namespace: string | undefined, name: string | undefined): Promise<Response> {
  const version = parseUuidVersion(versionValue);
  if (version === null) return error("Supported UUID versions: 1, 3, 4, 5, 6, 7, 8.");
  if ((version === 3 || version === 5) && (namespace === undefined || name === undefined)) {
    return error("UUID versions 3 and 5 require namespace and name query parameters.");
  }
  if (version === 8 && (namespace === undefined) !== (name === undefined)) {
    return error("UUID version 8 requires both namespace and name for deterministic output.");
  }
  try { return json({ uuid: await generateUuid(version, namespace, name) }); }
  catch (cause) { return error(cause instanceof Error ? cause.message : "Invalid UUID parameters."); }
}
app.get("/uuid", (c) => uuidResponse(c.req.query("version"), c.req.query("namespace"), c.req.query("name")));
app.get("/uuid/:version", (c) => uuidResponse(c.req.param("version"), c.req.query("namespace"), c.req.query("name")));
app.get("/bytes/:n", (c) => {
  const count = intParam(c.req.param("n"), MAX_BYTES);
  if (count === null) return error("Invalid byte count.");
  return new Response(randomBytes(count, c.req.query("seed")).buffer as ArrayBuffer, { headers: { "content-type": "application/octet-stream", "cache-control": "no-store" } });
});
app.get("/base64/:value", (c) => {
  try {
    const raw = c.req.param("value").replace(/-/g, "+").replace(/_/g, "/");
    if (raw.length > MAX_BYTES * 2 || !/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) return error("Invalid Base64 value.");
    const binary = atob(raw);
    return new Response(Uint8Array.from(binary, (char) => char.charCodeAt(0)), { headers: { "content-type": "application/octet-stream", "x-content-type-options": "nosniff", "cache-control": "no-store" } });
  } catch { return error("Invalid Base64 value."); }
});

app.get("/stream/:n", (c) => {
  const n = intParam(c.req.param("n"), 100);
  if (n === null) return error("Invalid stream length.");
  const info = requestInfo(c.req.raw);
  return streamed((controller) => {
    for (let index = 0; index < n; index++) controller.enqueue(encoder.encode(JSON.stringify({ ...info, id: index }) + "\n"));
  }, "application/x-ndjson; charset=utf-8");
});
app.get("/stream-bytes/:n", (c) => {
  const n = intParam(c.req.param("n"), MAX_BYTES);
  if (n === null) return error("Invalid byte count.");
  const chunk = intParam(c.req.query("chunk_size") || "10240", 65536, 1);
  if (chunk === null) return error("Invalid chunk size.");
  const bytes = randomBytes(n, c.req.query("seed"));
  return streamed((controller) => {
    for (let offset = 0; offset < n; offset += chunk) controller.enqueue(bytes.subarray(offset, Math.min(offset + chunk, n)));
  }, "application/octet-stream");
});
app.get("/delay/:n", async (c) => {
  const number = Number(c.req.param("n"));
  if (!Number.isFinite(number) || number < 0) return error("Invalid delay.");
  await sleep(seconds(String(number)) * 1000);
  return json(requestInfo(c.req.raw));
});
app.get("/drip", (c) => {
  const url = new URL(c.req.url);
  const duration = seconds(url.searchParams.get("duration"), 2);
  const delay = seconds(url.searchParams.get("delay"), 0);
  const count = intParam(url.searchParams.get("numbytes") || "10", 100, 1);
  const status = Number(url.searchParams.get("code") || "200");
  if (count === null || !Number.isInteger(status) || status < 200 || status > 599 || [204, 205, 304].includes(status)) return error("Invalid drip parameters.");
  return streamed(async (controller) => {
    if (delay) await sleep(delay * 1000);
    for (let i = 0; i < count; i++) {
      controller.enqueue(encoder.encode("*"));
      if (i < count - 1 && duration) await sleep(duration * 1000 / count);
    }
  }, "application/octet-stream", status);
});
app.on(["GET", "HEAD"], "/range/:n", (c) => {
  const length = intParam(c.req.param("n"), MAX_BYTES);
  if (length === null) return error("Invalid range length.");
  const etag = '"range-' + length + '"';
  const headers = new Headers({
    "content-type": "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": "no-store",
    "etag": etag,
    "last-modified": LAST_MODIFIED,
  });
  const conditional = preconditionStatus(c.req.raw, etag, LAST_MODIFIED);
  if (conditional !== null) return new Response(null, { status: conditional, headers });

  const rangeHeader = c.req.header("range") ?? null;
  const ifRange = c.req.header("if-range");
  const shouldRange = rangeHeader !== null && (ifRange === undefined || ifRangeMatches(ifRange, etag, LAST_MODIFIED));
  const range = selectByteRanges(shouldRange ? rangeHeader : null, length);
  if (range.kind === "unsatisfiable") {
    headers.set("content-range", "bytes */" + length);
    return new Response(null, { status: 416, headers });
  }

  if (range.kind === "multipart") {
    const boundary = "httpbin-" + crypto.randomUUID().replaceAll("-", "");
    headers.set("content-type", "multipart/byteranges; boundary=" + boundary);
    const chunks: Uint8Array[] = [];
    let total = 0;
    const append = (chunk: Uint8Array) => { chunks.push(chunk); total += chunk.byteLength; };
    for (const part of range.parts) {
      append(encoder.encode("--" + boundary + "\r\nContent-Type: application/octet-stream\r\nContent-Range: bytes " + part.start + "-" + part.end + "/" + length + "\r\n\r\n"));
      const body = new Uint8Array(part.end - part.start + 1);
      for (let index = 0; index < body.length; index++) body[index] = 97 + ((part.start + index) % 26);
      append(body);
      append(encoder.encode("\r\n"));
    }
    append(encoder.encode("--" + boundary + "--\r\n"));
    headers.set("content-length", String(total));
    if (c.req.method === "HEAD") return new Response(null, { status: 206, headers });
    const content = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { content.set(chunk, offset); offset += chunk.byteLength; }
    return new Response(content, { status: 206, headers });
  }

  const start = range.kind === "partial" ? range.start : 0;
  const end = range.kind === "partial" ? range.end : length - 1;
  const size = Math.max(0, end - start + 1);
  headers.set("content-length", String(size));
  if (range.kind === "partial") headers.set("content-range", "bytes " + start + "-" + end + "/" + length);
  if (c.req.method === "HEAD") return new Response(null, { status: range.kind === "partial" ? 206 : 200, headers });
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = 97 + ((start + i) % 26);
  return new Response(bytes, { status: range.kind === "partial" ? 206 : 200, headers });
});

app.on(["GET", "HEAD"], "/cache", (c) => {
  const etag = '"http-cache-v1"';
  const headers = new Headers({ etag, "last-modified": LAST_MODIFIED, "cache-control": "no-store" });
  const conditional = preconditionStatus(c.req.raw, etag, LAST_MODIFIED);
  if (conditional !== null) return new Response(null, { status: conditional, headers });
  const response = json({ resource: "cache", version: 1 }, 200, headers);
  return c.req.method === "HEAD" ? new Response(null, { status: 200, headers: response.headers }) : response;
});

app.get("/cache/:n", (c) => {
  const n = intParam(c.req.param("n"), 31536000);
  if (n === null) return error("Invalid cache lifetime.");
  return json({ resource: "cache", maxAge: n });
});

app.on(["GET", "HEAD"], "/etag/:etag", (c) => {
  const value = c.req.param("etag");
  if (value.length > 128 || !/^[\x21\x23-\x7e]+$/.test(value)) return error("Invalid entity tag.");
  const etag = '"' + value + '"';
  const headers = new Headers({ etag, "cache-control": "no-store" });
  const conditional = preconditionStatus(c.req.raw, etag);
  if (conditional !== null) return new Response(null, { status: conditional, headers });
  const response = json({ etag: value }, 200, headers);
  return c.req.method === "HEAD" ? new Response(null, { status: 200, headers: response.headers }) : response;
});

app.get("/json", () => json({ slideshow: { author: "Yours Truly", date: "date of publication", slides: [{ title: "Wake up to WonderWidgets!", type: "all" }, { items: ["Why WonderWidgets are great", "Who buys WonderWidgets"], title: "Overview", type: "all" }], title: "Sample Slide Show" } }));
app.get("/html", () => new Response("<!doctype html><html lang=\"en\"><head><title>HTTPBin</title></head><body><h1>Herman Melville - Moby-Dick</h1><p>Call me Ishmael.</p></body></html>", { headers: { "content-type": "text/html; charset=utf-8" } }));
app.get("/xml", () => new Response('<?xml version="1.0" encoding="utf-8"?><slideshow><title>Sample Slide Show</title><slide>Wake up to WonderWidgets!</slide></slideshow>', { headers: { "content-type": "application/xml; charset=utf-8" } }));
app.get("/encoding/utf8", () => new Response("UTF-8 sample: Hello, " + String.fromCodePoint(0x4e16, 0x754c) + "!\n", { headers: { "content-type": "text/plain; charset=utf-8" } }));

function compressed(request: Request, format: "gzip" | "deflate" | "br"): Response {
  if (!acceptsEncoding(request.headers.get("accept-encoding"), format)) {
    return new Response(null, { status: 406, headers: { "vary": "Accept-Encoding", "cache-control": "no-store" } });
  }
  const payload = JSON.stringify({ ...requestInfo(request), [format === "br" ? "brotli" : format]: true }) + "\n";
  try {
    const compressor = new CompressionStream(format as CompressionFormat);
    const stream = new Blob([payload]).stream().pipeThrough(compressor);
    return new Response(stream, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-encoding": format,
        "vary": "Accept-Encoding",
        "cache-control": "no-store",
      },
    });
  } catch { return error("This runtime does not support " + format + " encoding.", 501); }
}
app.get("/gzip", (c) => compressed(c.req.raw, "gzip"));
app.get("/deflate", (c) => compressed(c.req.raw, "deflate"));
app.get("/brotli", (c) => compressed(c.req.raw, "br"));

const samples: Record<string, string> = {
  png: "iVBORw0KGgoAAAANSUhEUgAAALQAAAB4CAIAAADUhU+qAAABxklEQVR42u3dQU4CQRCGUWfCWUzwTnA4D0Uip3HrgkAwA1P11/vWxkT7dc1oQvdyPP18SLda/QoEh+AQHIJDcAgOwSE4BIfgkOAQHIJDcAgOwSE4BIfgEBwSHIJDcAgOwSE4BIfgEByCQzoM//kv35/3v+DrfB37y1kGHt7yEAQoE3H8m8VMIlNwbMJiGpF8HJuzmENkJaPy94ej98oF+8h8rOyyYHmPmJUMI2QKjn1XKMyHf59rBo4KGzdpeKxk8BGOo9p6ZPjwzqFoHDW3acDwMDmUi6PyBu0+PEwOheKovzVbDw+TQ3AIDsHR6XHe97XD5BAcgkNwCA7BITgEh+AQHIKjYV0+ftj3Y5Imh+AQHIKjzeO89bkMJodycVTemt2PczE5FI2j5gYNOAXK5FA6jmrbNOPwuJzJUWc9Yo4VjHqsVFiVpAMnvXNoDI59N27YObWBk2OvFco7wTj51oS3fQ4x9e6E5HeO96xZ8K0a4S+kr1657PtW3NSExXgcGxJxxxsio1nMxfEUFPfKSvP+WhEcgkNwCA7BITgEh+CQ4BAcgkNwCA7BITgEh+AQHIJDgkNwCA7BITgEh+AQHIJDcEh/+gXB8HRb6IkATQAAAABJRU5ErkJggg==",
  jpeg: "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",
  webp: "UklGRioDAABXRUJQVlA4IB4DAADwFwCdASq0AHgAPlEokUYjoqGhJRmYAHAKCWVu4XVL5E+c/jdrmHPv4B+x/Md7N+AMNo5gO0B4i/SA8wH7FegB6s/QA/on906xj0AP2O9Mr2N/3H/ar2mc0A/tzHBgAGuKfnP+u8gX45/XPYC/jv866oHoPfreITRYCwFgLAWAsBYCwDlN94qwv/vJbigsnh8GRjhpfgB0AgchvwCz29FXuG9w6md7ns94qWebXbglIHs9ne6zFFhxL7RbZKgqq9D3b0WAsBYBwAD+/s4VtlnpWPSsCvOV5esigCfP6Z97bwwYhy2A0d/EwQknYCGO+aQimI396HRa2pwUT+JiAG7qeFjWfk2BIShIVobbI7bUwLmC8n1094a1OV30/CGMNs21EoFs7oIG6Dwpy1KgNA6jTp++p6cEuMjEi3837hXrlr2qcnqaOkb+0PuQDyfyrvh6xyNxy/dRTP7ZGef8hge7u0O4uzeXZjXkIgQnEq741VGjQbwePnNR4d6vTJqBe67YUpd9HFF8srhzkVEokI5vZ7DVJiF52PS+qqDeiVgKcMrKLNPR5YKRYd6mYx+L+kAiQi8IuNynIcMphTR8tFnwKCi5KSX7gVOfHROd+BAU/btDgG643NPTnKe86EkSBut47nOpMsC1StA8bRXfiL0dTQsWxWIqSSghq15qCFMDB+caRswJH+ArzJD4J7W0/c+ZB2+tPEkc/j4M7tXNo8rXRBC76hE69VSdEzLyhpat15YAhlO9yFavFl4wsTSqXnB/Y6fPxh5l/M8rwFdtraxlqzAq34xMxErNh3Knv8/XPrgrCqCEd1PPw3nWUHj71BqoL2Ss4oHkWHiU4tHFm6pWTtaz/tk4p272+t4EkKObcVzj5mg9CY4EMt2j1m8pK89rsJudI/L535kQV7HYjp4rbARo0e7I2dnMwkXN1ikoLdJtxZIptbk45SITlB1UZ0lRs/iXdrgQhDj7UTWMw+ak+34F5bf8BrJt0PZKW+vwsEx9us8w3K/RSTCniyfToEr20HND02q9tKpXYvrbrJT3xYpBRs7aRgmmPQAAAAA=",
};
function imageResponse(kind: string): Response {
  if (kind === "svg") {
    return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120" viewBox="0 0 180 120"><rect width="180" height="120" fill="#295dd9"/><circle cx="90" cy="60" r="28" fill="#fff"/></svg>', { headers: { "content-type": "image/svg+xml", "x-content-type-options": "nosniff" } });
  }
  const format = kind === "jpg" ? "jpeg" : kind;
  if (format === "bmp") {
    return new Response(bmpSample().buffer as ArrayBuffer, { headers: { "content-type": "image/bmp", "x-content-type-options": "nosniff" } });
  }
  const sample = Object.hasOwn(samples, format) ? samples[format] :
    Object.hasOwn(additionalImageSamples, format) ? additionalImageSamples[format as keyof typeof additionalImageSamples] : null;
  if (!sample) return error("Unsupported image format.", 404);
  const data = atob(sample);
  const type = format === "ico" ? "image/x-icon" : "image/" + format;
  return new Response(Uint8Array.from(data, (byte) => byte.charCodeAt(0)), { headers: { "content-type": type, "x-content-type-options": "nosniff" } });
}
app.get("/image", (c) => {
  const format = negotiateImage(c.req.header("accept") ?? null);
  if (!format) return new Response(null, { status: 406, headers: { "vary": "Accept" } });
  const response = imageResponse(format);
  response.headers.set("vary", "Accept");
  return response;
});
app.get("/image/:kind", (c) => imageResponse(c.req.param("kind")));

app.get("/links/:n", (c) => {
  const count = intParam(c.req.param("n"), 100, 1);
  if (count === null) return error("Invalid link count.");
  const active = intParam(c.req.query("offset") || "0", count - 1) ?? 0;
  const links = Array.from({ length: count }, (_, index) => index === active ? "<strong>" + index + "</strong>" : '<a href="/links/' + count + '?offset=' + index + '">' + index + "</a>").join(" ");
  return new Response("<!doctype html><html><body>" + links + "</body></html>", { headers: { "content-type": "text/html; charset=utf-8" } });
});
app.get("/forms/post", () => new Response('<!doctype html><html><body><form method="post" action="/post"><label>Customer name <input name="custname"></label><label>Comments <textarea name="comments"></textarea></label><button type="submit">Submit</button></form></body></html>', { headers: { "content-type": "text/html; charset=utf-8" } }));
app.get("/robots.txt", () => new Response("User-agent: *\nDisallow: /deny\n", { headers: { "content-type": "text/plain; charset=utf-8" } }));
app.get("/deny", () => new Response("YOU SHOULDN'T BE HERE\n", { headers: { "content-type": "text/plain; charset=utf-8" } }));

app.on("HEAD", "/*", async (c) => {
  const get = new Request(c.req.url, { method: "GET", headers: c.req.raw.headers });
  const response = await app.fetch(get);
  void response.body?.cancel().catch(() => {});
  return new Response(null, { status: response.status, headers: response.headers });
});

app.notFound((c) => {
  const path = new URL(c.req.url).pathname;
  const allowed = allowedMethods(path);
  if (allowed.length) return problem("Method " + c.req.method + " is not allowed for " + path + ".", 405, { allow: allowed.join(", ") });
  return error("Endpoint not found: " + escapeHtml(path), 404);
});
app.onError(() => error("Internal server error.", 500));

export default app;
