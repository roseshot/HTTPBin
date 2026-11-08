import type { Hono } from "hono";
import { json } from "../lib/http";
import { digestAuth } from "../lib/digest";

export function registerAuthenticationRoutes(app: Hono): void {
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
}
