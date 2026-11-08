import type { Hono } from "hono";
import { error } from "../lib/http";
import { negotiateImage } from "../lib/negotiation";
import { samples, additionalImageSamples, bmpSample } from "../fixtures/images";

export function registerImageRoutes(app: Hono): void {
  function imageResponse(kind: string): Response {
    if (kind === "svg") {
      return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120" viewBox="0 0 180 120"><rect width="180" height="120" fill="#295dd9"/><circle cx="90" cy="60" r="28" fill="#fff"/></svg>', { headers: { "content-type": "image/svg+xml", "x-content-type-options": "nosniff", "cache-control": "public, max-age=3600" } });
    }
    const format = kind === "jpg" ? "jpeg" : kind;
    if (format === "bmp") {
      return new Response(bmpSample().buffer as ArrayBuffer, { headers: { "content-type": "image/bmp", "x-content-type-options": "nosniff", "cache-control": "public, max-age=3600" } });
    }
    const sample = Object.hasOwn(samples, format) ? samples[format] :
      Object.hasOwn(additionalImageSamples, format) ? additionalImageSamples[format as keyof typeof additionalImageSamples] : null;
    if (!sample) return error("Unsupported image format.", 404);
    const data = atob(sample);
    const type = format === "ico" ? "image/x-icon" : "image/" + format;
    return new Response(Uint8Array.from(data, (byte) => byte.charCodeAt(0)), { headers: { "content-type": type, "x-content-type-options": "nosniff", "cache-control": "public, max-age=3600" } });
  }
  app.get("/image", (c) => {
    const format = negotiateImage(c.req.header("accept") ?? null);
    if (!format) return new Response(null, { status: 406, headers: { "vary": "Accept" } });
    const response = imageResponse(format);
    response.headers.set("vary", "Accept");
    return response;
  });
  app.get("/image/:kind", (c) => imageResponse(c.req.param("kind")));
}
