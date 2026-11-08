import { describe, expect, test } from "bun:test";
import app from "./index";
import { acceptsEncoding, negotiateImage } from "./lib/negotiation";
import { md5Hex } from "./lib/digest";

describe("RFC 9110 method and representation semantics", () => {
  test("exposes resource-specific Allow headers", async () => {
    const post = await app.request("/post", { method: "OPTIONS" });
    expect(post.status).toBe(204);
    expect(post.headers.get("allow")).toContain("POST");
    expect(post.headers.get("allow")).not.toContain("DELETE");
    const get = await app.request("/get", { method: "OPTIONS" });
    expect(get.headers.get("allow")).toContain("HEAD");
    const absent = await app.request("/missing", { method: "OPTIONS" });
    expect(absent.status).toBe(404);
  });

  test("serves GET metadata without a response body for HEAD", async () => {
    const response = await app.request("/json", { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.text()).toBe("");
    expect((await app.request("/missing", { method: "HEAD" })).status).toBe(404);
  });

  test("refuses oversized response fixtures instead of silently truncating them", async () => {
    expect((await app.request("/bytes/1048577")).status).toBe(400);
    expect((await app.request("/stream/101")).status).toBe(400);
    expect((await app.request("/range/1048577")).status).toBe(400);
    expect((await app.request("/bytes/0")).status).toBe(200);
  });

  test("keeps cacheable fixtures invariant across request headers", async () => {
    const first = await app.request("/cache", { headers: { authorization: "Bearer one", "x-sample": "one" } });
    const second = await app.request("/cache", { headers: { authorization: "Bearer two", "x-sample": "two" } });
    expect(first.headers.get("cache-control")).toBe("public, max-age=0");
    expect(await first.text()).toBe(await second.text());
    const timed = await app.request("/cache/30", { headers: { authorization: "Bearer token" } });
    expect(timed.headers.get("cache-control")).toBe("public, max-age=30");
    expect(await timed.json()).toEqual({ resource: "cache", maxAge: 30 });
    const etag = await app.request("/etag/demo", { headers: { authorization: "Bearer secret" } });
    expect((await etag.json() as { etag: string }).etag).toBe("demo");
  });

  test("uses the registered JSON-sequence media type", async () => {
    const stream = await app.request("/stream/2");
    expect(stream.headers.get("content-type")).toContain("application/x-ndjson");
    const records = (await stream.text()).trim().split("\n").map((line) => JSON.parse(line) as { id: number });
    expect(records.map((item) => item.id)).toEqual([0, 1]);
  });

  test("negotiates images using specificity and quality", async () => {
    expect(negotiateImage(null)).toBe("png");
    expect(negotiateImage("image/jpeg;q=0.4,image/webp;q=0.8")).toBe("webp");
    expect(negotiateImage("image/png;q=0,image/*;q=1")).not.toBe("png");
    expect(negotiateImage("image/*;q=0")).toBeNull();
    expect(negotiateImage("application/json")).toBeNull();
    const response = await app.request("/image", { headers: { accept: "image/webp;q=1,image/png;q=0" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("vary")).toBe("Accept");
    expect((await app.request("/image", { headers: { accept: "application/json" } })).status).toBe(406);
  });

  test("respects content-coding refusal and returns Vary", async () => {
    expect(acceptsEncoding(null, "gzip")).toBe(true);
    expect(acceptsEncoding("gzip;q=0, *;q=1", "gzip")).toBe(false);
    expect(acceptsEncoding("br, gzip;q=0.5", "gzip")).toBe(true);
    expect(acceptsEncoding("identity", "gzip")).toBe(false);
    const response = await app.request("/gzip", { headers: { "accept-encoding": "identity" } });
    expect(response.status).toBe(406);
    expect(response.headers.get("vary")).toBe("Accept-Encoding");
  });

  test("uses case-insensitive Basic scheme and advertises UTF-8", async () => {
    const unauthorized = await app.request("/basic-auth/demo/secret");
    expect(unauthorized.headers.get("www-authenticate")).toContain('charset="UTF-8"');
    const auth = await app.request("/basic-auth/demo/secret", {
      headers: { authorization: "basic " + btoa("demo:secret") },
    });
    expect(auth.status).toBe(200);
    expect((await auth.json() as { authenticated: boolean }).authenticated).toBe(true);
  });

  test("validates Set-Cookie names and adds Secure on HTTPS", async () => {
    const response = await app.request("https://httpbin.example/cookies/set?valid=1&bad%20name=value");
    expect(response.status).toBe(302);
    const cookie = response.headers.get("set-cookie") || "";
    expect(cookie).toContain("valid=1");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("bad%20name");
  });

  test("advertises HEAD, OPTIONS, and security schemes in OpenAPI", async () => {
    const spec = await (await app.request("/openapi.json")).json() as any;
    expect(spec.paths["/get"].head).toBeDefined();
    expect(spec.paths["/get"].options).toBeDefined();
    expect(spec.paths["/anything/{path}"].post).toBeDefined();
    expect(spec.paths["/response-headers"].post).toBeDefined();
    expect(spec.components.securitySchemes.digestAuth.scheme).toBe("digest");
    const swagger = await (await app.request("/spec.json")).json() as any;
    expect(swagger.swagger).toBe("2.0");
  });
});

describe("RFC 7616 Digest demonstration", () => {
  test("uses unpredictable challenges and prevents nonce-count replay within an isolate", async () => {
    const uri = "/digest-auth/auth/demo/secret/MD5";
    const first = await app.request(uri);
    const second = await app.request(uri);
    const challenge = first.headers.get("www-authenticate") || "";
    const nonce = /nonce="([^"]+)"/.exec(challenge)?.[1];
    expect(nonce).toBeTruthy();
    expect(second.headers.get("www-authenticate")).not.toBe(challenge);
    const nc = "00000001", cnonce = "client-one";
    const ha1 = md5Hex("demo:HTTPBin:secret");
    const ha2 = md5Hex("GET:" + uri);
    const response = md5Hex([ha1, nonce, nc, cnonce, "auth", ha2].join(":"));
    const authorization = 'Digest username="demo", realm="HTTPBin", nonce="' + nonce +
      '", uri="' + uri + '", qop=auth, nc=' + nc + ', cnonce="' + cnonce +
      '", response="' + response + '", algorithm=MD5';
    const authenticated = await app.request(uri, { headers: { authorization } });
    expect(authenticated.status).toBe(200);
    const replay = await app.request(uri, { headers: { authorization } });
    expect(replay.status).toBe(401);
  });

  test("defaults to SHA-256 rather than MD5", async () => {
    const response = await app.request("/digest-auth/auth/demo/secret");
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("algorithm=SHA-256");
  });
});
