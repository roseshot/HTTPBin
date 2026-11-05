import { describe, expect, test } from "bun:test";
import app from "./index";

describe("HTTP request inspection", () => {
  test("echoes GET query parameters and headers", async () => {
    const response = await app.request("/get?name=alice&name=bob", { headers: { "user-agent": "httpbin-test" } });
    const data = await response.json() as Record<string, any>;
    expect(response.status).toBe(200);
    expect(data.args.name).toEqual(["alice", "bob"]);
    expect(data.headers["User-Agent"]).toBe("httpbin-test");
    expect(data.json).toBeNull();
  });
  test("echoes JSON POST bodies", async () => {
    const response = await app.request("/post", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hello: "world" }) });
    const data = await response.json() as Record<string, any>;
    expect(data.json).toEqual({ hello: "world" });
    expect(data.data).toBe('{"hello":"world"}');
  });
  test("echoes URL-encoded forms", async () => {
    const response = await app.request("/post", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "name=alice&name=bob" });
    const data = await response.json() as Record<string, any>;
    expect(data.form.name).toEqual(["alice", "bob"]);
  });
  test("accepts arbitrary methods and paths", async () => {
    const response = await app.request("/anything/example", { method: "PATCH", headers: { "content-type": "text/plain" }, body: "hello" });
    expect(response.status).toBe(200);
    expect((await response.json() as any).data).toBe("hello");
  });
  test("rejects oversized requests", async () => {
    const response = await app.request("/post", { method: "POST", body: "a".repeat(1024 * 1024 + 1) });
    expect(response.status).toBe(413);
  });
});

describe("HTTP response behavior", () => {
  test("implements basic and bearer authentication", async () => {
    expect((await app.request("/basic-auth/demo/secret")).status).toBe(401);
    const basic = await app.request("/basic-auth/demo/secret", { headers: { authorization: "Basic " + btoa("demo:secret") } });
    expect((await basic.json() as any).authenticated).toBe(true);
    expect((await app.request("/hidden-basic-auth/demo/secret")).status).toBe(404);
    expect((await app.request("/bearer", { headers: { authorization: "Bearer token123" } })).status).toBe(200);
  });
  test("redirects without server-side outbound fetch", async () => {
    const response = await app.request("/redirect/3");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/relative-redirect/2");
    const to = await app.request("/redirect-to?url=https%3A%2F%2Fexample.com&status_code=307");
    expect(to.status).toBe(307);
    expect(to.headers.get("location")).toBe("https://example.com");
  });
  test("sets and expires cookies", async () => {
    const set = await app.request("/cookies/set?foo=bar");
    expect(set.headers.get("set-cookie")).toContain("foo=bar");
    const view = await app.request("/cookies", { headers: { cookie: "foo=bar" } });
    expect((await view.json() as any).cookies.foo).toBe("bar");
    const remove = await app.request("/cookies/delete?foo");
    expect(remove.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  test("returns valid status codes and rejects unsupported informational statuses", async () => {
    expect((await app.request("/status/418")).status).toBe(418);
    expect((await app.request("/status/204")).status).toBe(204);
    expect((await app.request("/status/101")).status).toBe(501);
    expect((await app.request("/status/not-a-code")).status).toBe(400);
  });
  test("returns entity tags and conditional responses", async () => {
    const response = await app.request("/etag/demo");
    expect(response.headers.get("etag")).toBe('"demo"');
    expect((await app.request("/etag/demo", { headers: { "if-none-match": '"demo"' } })).status).toBe(304);
    expect((await app.request("/etag/demo", { headers: { "if-match": '"different"' } })).status).toBe(412);
  });
  test("serves byte ranges and invalid range responses", async () => {
    const response = await app.request("/range/26", { headers: { range: "bytes=1-3" } });
    expect(response.status).toBe(206);
    expect(await response.text()).toBe("bcd");
    expect(response.headers.get("content-range")).toBe("bytes 1-3/26");
    expect((await app.request("/range/4", { headers: { range: "bytes=9-10" } })).status).toBe(416);
  });
  test("generates random bytes and a UUID", async () => {
    expect((await (await app.request("/bytes/16")).arrayBuffer()).byteLength).toBe(16);
    expect((await (await app.request("/uuid")).json() as any).uuid).toMatch(/^[0-9a-f-]{36}$/);
  });
  test("streams newline-delimited JSON", async () => {
    const response = await app.request("/stream/3");
    const lines = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
    expect(lines.map((line) => line.id)).toEqual([0, 1, 2]);
  });
  test("returns OpenAPI and Swagger specifications", async () => {
    const openapi = await (await app.request("/openapi.json")).json() as any;
    const swagger = await (await app.request("/spec.json")).json() as any;
    expect(openapi.openapi).toBe("3.1.0");
    expect(openapi.paths["/get"].get).toBeDefined();
    expect(swagger.swagger).toBe("2.0");
  });
});
