import type { Hono } from "hono";
import { error, json, requestInfo } from "../lib/http";
import { acceptsEncoding } from "../lib/negotiation";

export function registerFormatRoutes(app: Hono): void {
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
}
