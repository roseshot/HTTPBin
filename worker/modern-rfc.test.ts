import { describe, expect, test } from "bun:test";
import app from "./index";
import { digestBytes, digestField, matchDigestField, parseDigestDictionary, preferMinimal } from "./protocol";

describe("RFC 9457 and RFC 9110 error semantics", () => {
  test("returns Problem Details with an HTTP-appropriate status", async () => {
    const response = await app.request("/bytes/not-an-integer");
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    const details = await response.json() as Record<string, unknown>;
    expect(details).toEqual({
      type: "about:blank", title: "Bad Request", status: 400, detail: "Invalid byte count.",
    });
  });

  test("distinguishes unknown resources from unsupported methods", async () => {
    const wrongMethod = await app.request("/get", { method: "POST" });
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("allow")).toContain("GET");
    expect(wrongMethod.headers.get("allow")).toContain("HEAD");
    expect((await wrongMethod.json() as { status: number }).status).toBe(405);
    expect((await app.request("/not-a-real-resource")).status).toBe(404);
    expect((await app.request("/query", { method: "OPTIONS" })).headers.get("allow")).toContain("QUERY");
  });
});

describe("RFC 10008 QUERY", () => {
  test("returns a safe, deterministic JSON query result", async () => {
    const options = { method: "QUERY", headers: { "content-type": "application/json" }, body: '{"find":"active"}' };
    const first = await app.request("/query", options);
    const second = await app.request("/query", options);
    expect(first.status).toBe(200);
    expect(first.headers.get("accept-query")).toBe('"application/json"');
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(await first.json()).toEqual(await second.json());
  });

  test("rejects missing or unsupported content type and malformed content", async () => {
    expect((await app.request("/query", { method: "QUERY", body: "{}" })).status).toBe(400);
    const unsupported = await app.request("/query", { method: "QUERY", headers: { "content-type": "text/plain" }, body: "hello" });
    expect(unsupported.status).toBe(415);
    expect(unsupported.headers.get("accept-query")).toBe('"application/json"');
    expect((await app.request("/query", { method: "QUERY", headers: { "content-type": "application/json" }, body: "{invalid" })).status).toBe(400);
    expect((await app.request("/query", { method: "QUERY", headers: { "content-type": "application/json", accept: "text/plain" }, body: "{}" })).status).toBe(406);
  });
});

describe("RFC 9530 Digest Fields and RFC 9651 serialization", () => {
  test("generates Content-Digest and Repr-Digest for both active hash algorithms", async () => {
    for (const algorithm of ["sha-256", "sha-512"] as const) {
      const response = await app.request("/digest/" + algorithm);
      expect(response.status).toBe(200);
      const content = new Uint8Array(await response.arrayBuffer());
      const expected = digestField(algorithm, await digestBytes(content, algorithm));
      expect(response.headers.get("content-digest")).toBe(expected);
      expect(response.headers.get("repr-digest")).toBe(expected);
    }
  });

  test("HEAD omits content but retains representation digest", async () => {
    const get = await app.request("/digest/sha-256");
    const head = await app.request("/digest/sha-256", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("repr-digest")).toBe(get.headers.get("repr-digest"));
    expect(head.headers.get("content-digest")).not.toBe(get.headers.get("content-digest"));
    expect(await head.text()).toBe("");
  });

  test("verifies actual content and rejects mismatch, missing, or malformed digests", async () => {
    const content = new TextEncoder().encode("hello RFC 9530");
    const field = digestField("sha-256", await digestBytes(content, "sha-256"));
    const post = (header: string, body: string) => app.request("/digest/verify", {
      method: "POST", headers: { "content-digest": header, "content-type": "text/plain" }, body,
    });
    const ok = await post(field, "hello RFC 9530");
    expect(ok.status).toBe(200);
    expect((await ok.json() as { verified: boolean }).verified).toBe(true);
    const mismatch = await post(field, "not the same");
    expect(mismatch.status).toBe(422);
    expect(mismatch.headers.get("content-type")).toBe("application/problem+json");
    expect((await post("sha-256=:not valid:", "hello")).status).toBe(400);
    expect((await app.request("/digest/verify", { method: "POST", body: "hello" })).status).toBe(400);
  });

  test("parses valid byte-sequence dictionaries without accepting duplicates", async () => {
    const empty = digestField("sha-256", await digestBytes(new Uint8Array(), "sha-256"));
    expect(parseDigestDictionary(empty)?.get("sha-256")?.length).toBe(32);
    expect(parseDigestDictionary(empty + ", " + empty)).toBeNull();
    expect(parseDigestDictionary("sha-256=?1")).toBeNull();
    expect(matchDigestField(empty, await digestBytes(new Uint8Array(), "sha-256"), "sha-256")).toBe("match");
  });
});

describe("RFC 7240, 6266, 8187, 8288, 9651 and 9745 fixtures", () => {
  test("honors minimal and representation preferences", async () => {
    expect(preferMinimal('respond-async, return="minimal"')).toBe(true);
    const minimal = await app.request("/prefer", { method: "POST", headers: { prefer: "return=minimal" }, body: "hello" });
    expect(minimal.status).toBe(204);
    expect(minimal.headers.get("preference-applied")).toBe("return=minimal");
    expect(await minimal.text()).toBe("");
    const full = await app.request("/prefer", { method: "POST", body: "hello" });
    expect(full.status).toBe(200);
    expect((await full.json() as { receivedBytes: number }).receivedBytes).toBe(5);
  });

  test("encodes UTF-8 filenames and rejects unsafe path segments", async () => {
    const response = await app.request("/download?filename=%E6%B5%8B%E8%AF%95.txt");
    expect(response.status).toBe(200);
    const disposition = response.headers.get("content-disposition") || "";
    expect(disposition).toContain('attachment; filename="__.txt"');
    expect(disposition).toContain("filename*=UTF-8''%E6%B5%8B%E8%AF%95.txt");
    expect((await app.request("/download?filename=..%2Fsecret")).status).toBe(400);
  });

  test("exposes typed Web Links and a structured deprecation date", async () => {
    const links = await app.request("/links/header?page=2");
    expect(links.headers.get("link")).toContain('rel="next"');
    expect(links.headers.get("link")).toContain('rel="prev"');
    const depreciation = await app.request("/deprecation");
    expect(depreciation.headers.get("deprecation")).toMatch(/^@\d+$/);
    expect(depreciation.headers.get("sunset")).toContain("GMT");
    const structured = await app.request("/structured-fields");
    expect(structured.headers.get("example-dictionary")).toBe("count=42, active, updated=@1735689600");
  });

  test("publishes QUERY in OpenAPI 3.2 but not invalid Swagger 2.0 operations", async () => {
    const spec = await (await app.request("/openapi.json")).json() as any;
    expect(spec.openapi).toBe("3.2.1");
    expect(spec.paths["/query"].query).toBeDefined();
    expect(spec.paths["/digest/verify"].post).toBeDefined();
    expect(spec.paths["/digest/{algorithm}"].get).toBeDefined();
    const swagger = await (await app.request("/spec.json")).json() as any;
    expect(swagger.paths["/query"].query).toBeUndefined();
  });
});
