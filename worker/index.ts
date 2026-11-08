import { Hono } from "hono";
import { endpoints } from "../shared/endpoints";
import { error, escapeHtml } from "./lib/http";
import { problem } from "./lib/protocol";
import { registerModernRoutes } from "./routes/modern";
import { registerInspectionRoutes, registerResponseRoutes } from "./routes/inspection";
import { registerAuthenticationRoutes } from "./routes/authentication";
import { registerRedirectRoutes } from "./routes/redirects";
import { registerUuidRoutes } from "./routes/uuid";
import { registerStreamingRoutes } from "./routes/streaming";
import { registerCachingRoutes } from "./routes/caching";
import { registerFormatRoutes } from "./routes/formats";
import { registerImageRoutes } from "./routes/images";
import { registerUtilityRoutes } from "./routes/utilities";

export const app = new Hono();

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

registerModernRoutes(app);
registerInspectionRoutes(app);
registerAuthenticationRoutes(app);
registerResponseRoutes(app);
registerRedirectRoutes(app);
registerUuidRoutes(app);
registerStreamingRoutes(app);
registerCachingRoutes(app);
registerFormatRoutes(app);
registerImageRoutes(app);
registerUtilityRoutes(app);

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
