import type { Hono } from "hono";
import { error, headersObject, inspect, json, origin, queryObject } from "../lib/http";

export function registerInspectionRoutes(app: Hono): void {
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
}



export function registerResponseRoutes(app: Hono): void {
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
}
