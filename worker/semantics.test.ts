import { describe, expect, test } from "bun:test";
import app from "./index";
import { LAST_MODIFIED, ifRangeMatches, preconditionStatus, selectByteRange } from "./semantics";

describe("HTTP preconditions", () => {
  test("supports strong If-Match and weak If-None-Match comparison", async () => {
    expect((await app.request("/etag/demo", { headers: { "if-match": '"demo"' } })).status).toBe(200);
    expect((await app.request("/etag/demo", { headers: { "if-match": 'W/"demo"' } })).status).toBe(412);
    const response = await app.request("/etag/demo", { headers: { "if-none-match": 'W/"demo"' } });
    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe('"demo"');
    expect(await response.text()).toBe("");
    expect((await app.request("/etag/demo", { headers: { "if-none-match": "*" } })).status).toBe(304);
  });

  test("enforces validator precedence and parses dates", async () => {
    const modified = LAST_MODIFIED;
    expect((await app.request("/cache", { headers: { "if-modified-since": "not-a-date" } })).status).toBe(200);
    expect((await app.request("/cache", { headers: { "if-modified-since": modified } })).status).toBe(304);
    expect((await app.request("/cache", { headers: { "if-modified-since": "Wed, 21 Oct 2015 07:27:59 GMT" } })).status).toBe(200);
    expect((await app.request("/cache", { headers: { "if-unmodified-since": "Wed, 21 Oct 2015 07:27:59 GMT" } })).status).toBe(412);
    expect((await app.request("/cache", { headers: { "if-match": '"http-cache-v1"', "if-unmodified-since": "Wed, 21 Oct 2015 07:27:59 GMT" } })).status).toBe(200);
    expect((await app.request("/cache", { headers: { "if-none-match": '"different"', "if-modified-since": modified } })).status).toBe(200);
    expect((await app.request("/cache", { headers: { "if-match": '"wrong"', "if-none-match": '"http-cache-v1"' } })).status).toBe(412);
  });

  test("uses method-sensitive If-None-Match status", () => {
    expect(preconditionStatus(new Request("https://example.com/", { method: "POST", headers: { "if-none-match": '"demo"' } }), '"demo"')).toBe(412);
    expect(preconditionStatus(new Request("https://example.com/", { method: "GET", headers: { "if-none-match": '"demo"' } }), '"demo"')).toBe(304);
  });
});

describe("Range requests", () => {
  test("supports suffix, open-ended, and bounded ranges", async () => {
    const suffix = await app.request("/range/26", { headers: { range: "bytes=-4" } });
    expect(suffix.status).toBe(206);
    expect(suffix.headers.get("content-range")).toBe("bytes 22-25/26");
    expect(suffix.headers.get("content-length")).toBe("4");
    expect(await suffix.text()).toBe("wxyz");
    const open = await app.request("/range/26", { headers: { range: "bytes=24-" } });
    expect(open.status).toBe(206);
    expect(await open.text()).toBe("yz");
    const bounded = await app.request("/range/26", { headers: { range: "bytes=1-3" } });
    expect(await bounded.text()).toBe("bcd");
  });

  test("returns 416 for unsatisfiable ranges and ignores multiple ranges", async () => {
    const invalid = await app.request("/range/26", { headers: { range: "bytes=-0" } });
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get("content-range")).toBe("bytes */26");
    const multiple = await app.request("/range/5", { headers: { range: "bytes=0-1,3-4" } });
    expect(multiple.status).toBe(206);
    expect(multiple.headers.get("content-type")).toContain("multipart/byteranges; boundary=");
    const body = await multiple.text();
    expect(body).toContain("Content-Range: bytes 0-1/5");
    expect(body).toContain("Content-Range: bytes 3-4/5");
    expect(body).toContain("\r\nab\r\n");
    expect(body).toContain("\r\nde\r\n");
    expect(selectByteRange("bytes=100-200", 5)).toEqual({ kind: "unsatisfiable" });
  });

  test("honors If-Range and checks validators before serving ranges", async () => {
    expect(ifRangeMatches('"range-26"', '"range-26"', LAST_MODIFIED)).toBe(true);
    expect(ifRangeMatches('W/"range-26"', '"range-26"', LAST_MODIFIED)).toBe(false);
    const current = await app.request("/range/26", { headers: { range: "bytes=1-3", "if-range": '"range-26"' } });
    expect(current.status).toBe(206);
    const stale = await app.request("/range/26", { headers: { range: "bytes=1-3", "if-range": '"stale"' } });
    expect(stale.status).toBe(200);
    expect(await stale.text()).toBe("abcdefghijklmnopqrstuvwxyz");
    const notModified = await app.request("/range/26", { headers: { range: "bytes=1-3", "if-none-match": '"range-26"' } });
    expect(notModified.status).toBe(304);
    expect(notModified.headers.get("content-range")).toBeNull();
  });

  test("returns response headers but no body for HEAD", async () => {
    const response = await app.request("/range/26", { method: "HEAD", headers: { range: "bytes=0-2" } });
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 0-2/26");
    expect(response.headers.get("content-length")).toBe("3");
    expect(await response.text()).toBe("");
  });
});

describe("Response handling", () => {
  test("overwrites requested response headers and rejects framing changes", async () => {
    const response = await app.request("/response-headers?Content-Type=text%2Fplain&X-Demo=one&X-Demo=two&Content-Length=999&Transfer-Encoding=chunked");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("x-demo")).toBe("two");
    expect(response.headers.get("content-length")).not.toBe("999");
    expect(response.headers.get("transfer-encoding")).toBeNull();
    expect(JSON.parse(await response.text())).toEqual({
      "Content-Type": "text/plain", "X-Demo": ["one", "two"], "Content-Length": "999", "Transfer-Encoding": "chunked",
    });
  });

  test("omits response bodies where prohibited and does not fabricate redirect targets", async () => {
    for (const status of [204, 205, 304]) {
      const response = await app.request("/status/" + status);
      expect(response.status).toBe(status);
      expect(await response.text()).toBe("");
    }
    const head = await app.request("/status/418", { method: "HEAD" });
    expect(head.status).toBe(418);
    expect(await head.text()).toBe("");
    expect((await app.request("/status/302")).headers.get("location")).toBeNull();
  });

  test("streams stable seeded bytes across chunk sizes", async () => {
    const small = await app.request("/stream-bytes/100?seed=demo&chunk_size=7");
    const large = await app.request("/stream-bytes/100?seed=demo&chunk_size=31");
    expect(Array.from(new Uint8Array(await small.arrayBuffer()))).toEqual(Array.from(new Uint8Array(await large.arrayBuffer())));
  });

  test("accepts DELETE bodies for inspection", async () => {
    const response = await app.request("/delete", { method: "DELETE", headers: { "content-type": "application/json" }, body: '{"resource":"demo"}' });
    expect((await response.json() as { json: unknown }).json).toEqual({ resource: "demo" });
  });
});
