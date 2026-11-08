import type { Hono } from "hono";
import { error, intParam, json } from "../lib/http";
import { LAST_MODIFIED, preconditionStatus } from "../lib/semantics";

export function registerCachingRoutes(app: Hono): void {
  app.on(["GET", "HEAD"], "/cache", (c) => {
    const etag = '"http-cache-v1"';
    const headers = new Headers({ etag, "last-modified": LAST_MODIFIED, "cache-control": "public, max-age=0" });
    const conditional = preconditionStatus(c.req.raw, etag, LAST_MODIFIED);
    if (conditional !== null) return new Response(null, { status: conditional, headers });
    const response = json({ resource: "cache", version: 1 }, 200, headers);
    return c.req.method === "HEAD" ? new Response(null, { status: 200, headers: response.headers }) : response;
  });
  
  app.get("/cache/:n", (c) => {
    const n = intParam(c.req.param("n"), 31536000);
    if (n === null) return error("Invalid cache lifetime.");
    return json({ resource: "cache", maxAge: n }, 200, { "cache-control": "public, max-age=" + n });
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
}
