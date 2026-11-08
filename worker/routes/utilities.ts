import type { Hono } from "hono";
import { error, intParam } from "../lib/http";

export function registerUtilityRoutes(app: Hono): void {
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
}
