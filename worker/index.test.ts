import { describe, expect, test } from "bun:test";
import app from "./index";
import { md5Hex } from "./lib/digest";

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a JSON object.");
  }
  return value as Record<string, unknown>;
}

describe("HTTP request inspection", () => {
  test("echoes GET query parameters and headers", async () => {
    const response = await app.request("/get?name=alice&name=bob", { headers: { "user-agent": "httpbin-test" } });
    const data = object(await response.json());
    expect(response.status).toBe(200);
    expect(object(data.args).name).toEqual(["alice", "bob"]);
    expect(object(data.headers)["User-Agent"]).toBe("httpbin-test");
    expect(data.json).toBeNull();
  });
  test("echoes JSON POST bodies", async () => {
    const response = await app.request("/post", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hello: "world" }) });
    const data = object(await response.json());
    expect(data.json).toEqual({ hello: "world" });
    expect(data.data).toBe('{"hello":"world"}');
  });
  test("echoes URL-encoded forms", async () => {
    const response = await app.request("/post", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "name=alice&name=bob" });
    const data = object(await response.json());
    expect(object(data.form).name).toEqual(["alice", "bob"]);
  });
  test("accepts arbitrary methods and paths", async () => {
    const response = await app.request("/anything/example", { method: "PATCH", headers: { "content-type": "text/plain" }, body: "hello" });
    expect(response.status).toBe(200);
    expect(object(await response.json()).data).toBe("hello");
  });
  test("rejects oversized requests", async () => {
    const response = await app.request("/post", { method: "POST", body: "a".repeat(1024 * 1024 + 1) });
    expect(response.status).toBe(413);
  });
});

describe("HTTP response behavior", () => {
  test("supports MD5 Digest authentication", async () => {
    expect(md5Hex("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5Hex("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    const uri = "/digest-auth/auth/demo/secret/MD5";
    const challenge = await app.request(uri);
    expect(challenge.status).toBe(401);
    const header = challenge.headers.get("www-authenticate") || "";
    const nonce = /nonce="([^"]+)"/.exec(header)?.[1];
    expect(nonce).toBeTruthy();
    const realm = "HTTPBin";
    const nc = "00000001", cnonce = "test-client";
    const ha1 = md5Hex("demo:" + realm + ":secret");
    const ha2 = md5Hex("GET:" + uri);
    const response = md5Hex([ha1, nonce, nc, cnonce, "auth", ha2].join(":"));
    const authorization = 'Digest username="demo", realm="' + realm + '", nonce="' + nonce + '", uri="' + uri + '", qop=auth, nc=' + nc + ', cnonce="' + cnonce + '", response="' + response + '"';
    const authenticated = await app.request(uri, { headers: { authorization } });
    expect(authenticated.status).toBe(200);
    expect(object(await authenticated.json()).authenticated).toBe(true);
  });
  test("implements basic and bearer authentication", async () => {
    expect((await app.request("/basic-auth/demo/secret")).status).toBe(401);
    const basic = await app.request("/basic-auth/demo/secret", { headers: { authorization: "Basic " + btoa("demo:secret") } });
    expect(object(await basic.json()).authenticated).toBe(true);
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
    expect(object(object(await view.json()).cookies).foo).toBe("bar");
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
    expect(object(await (await app.request("/uuid")).json()).uuid).toMatch(/^[0-9a-f-]{36}$/);
  });
  test("streams newline-delimited JSON", async () => {
    const response = await app.request("/stream/3");
    const lines = (await response.text()).trim().split("\n").map((line) => object(JSON.parse(line)));
    expect(lines.map((line) => line.id)).toEqual([0, 1, 2]);
  });
  test("returns OpenAPI and Swagger specifications", async () => {
    const openapi = object(await (await app.request("/openapi.json")).json());
    const swagger = object(await (await app.request("/spec.json")).json());
    expect(openapi.openapi).toBe("3.2.1");
    expect(object(object(openapi.paths)["/get"]).get).toBeDefined();
    expect(swagger.swagger).toBe("2.0");
  });
});

describe("Image responses", () => {
  for (const format of ["png", "jpeg", "webp"] as const) {
    test(`serves a 180x120 ${format.toUpperCase()} image`, async () => {
      const response = await app.request(`/image/${format}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(`image/${format}`);

      const bytes = new Uint8Array(await response.arrayBuffer());
      expect(bytes.length).toBeGreaterThan(100);
      if (format === "png") {
        expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
        const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        expect(data.getUint32(16)).toBe(180);
        expect(data.getUint32(20)).toBe(120);
      } else if (format === "jpeg") {
        expect(Array.from(bytes.slice(0, 3))).toEqual([255, 216, 255]);
        expect(Array.from(bytes.slice(-2))).toEqual([255, 217]);
        const start = bytes.findIndex((byte, index) => byte === 255 && bytes[index + 1] === 192);
        expect(start).toBeGreaterThan(0);
        expect((bytes[start + 7] << 8) | bytes[start + 8]).toBe(180);
        expect((bytes[start + 5] << 8) | bytes[start + 6]).toBe(120);
      } else {
        const label = new TextDecoder().decode(bytes.subarray(0, 16));
        expect(label.slice(0, 4)).toBe("RIFF");
        expect(label.slice(8, 16)).toBe("WEBPVP8 ");
        expect(((bytes[27] << 8) | bytes[26]) & 0x3fff).toBe(180);
        expect(((bytes[29] << 8) | bytes[28]) & 0x3fff).toBe(120);
      }
    });
  }

  test("negotiates JPEG images", async () => {
    const response = await app.request("/image", { headers: { accept: "image/jpeg" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("vary")).toBe("Accept");
  });
});
