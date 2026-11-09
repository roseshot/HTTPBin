import type { Hono } from "hono";
import { endpoints } from "../../shared/endpoints";
import { encoder, intParam, json } from "../lib/http";
import { openApi, swagger } from "../lib/openapi";
import { ACCEPT_QUERY, boundedBody, digestBytes, digestField, matchDigestField, preferMinimal, problem, type DigestAlgorithm } from "../lib/protocol";

export function registerModernRoutes(app: Hono): void {
  // RFC 10008: a safe, idempotent query fixture, without persistent state.
  app.on("QUERY", "/query", async (c) => {
    const headers = { "accept-query": ACCEPT_QUERY };
    const contentType = c.req.header("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (!contentType) return problem("QUERY requires a Content-Type field.", 400, headers);
    if (contentType !== "application/json") return problem("Only application/json queries are supported.", 415, headers);
    const accept = c.req.header("accept");
    if (accept && !accept.split(",").some((part) => {
      const [media = "", ...options] = part.trim().toLowerCase().split(";");
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
    if (filename.length > 200 || [...filename].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === "/" || char === "\\") || filename === "." || filename === "..") {
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
}
