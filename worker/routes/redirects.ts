import type { Hono } from "hono";
import { error, intParam, json } from "../lib/http";

export function registerRedirectRoutes(app: Hono): void {
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
}
