import type { Hono } from "hono";
import { MAX_BYTES, encoder, error, intParam, json, randomBytes, requestInfo, seconds, sleep, streamed } from "../lib/http";
import { LAST_MODIFIED, ifRangeMatches, preconditionStatus, selectByteRanges } from "../lib/semantics";

export function registerStreamingRoutes(app: Hono): void {
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
}
