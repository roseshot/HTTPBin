import { describe, expect, test } from "bun:test";
import { endpoints, type Endpoint } from "../../../shared/endpoints";
import app from "../../../worker/index";
import { endpointRequestDefaults } from "./request-defaults";

function sample(path: string) {
  const endpoint = endpoints.find((item) => item.path === path);
  if (!endpoint) throw new Error("Missing endpoint: " + path);
  return endpointRequestDefaults(endpoint);
}

function requestUrl(defaults: ReturnType<typeof endpointRequestDefaults>): string {
  const url = new URL(defaults.path, "https://example.invalid");
  for (const { key, value } of defaults.params) url.searchParams.append(key, value);
  return url.pathname + url.search;
}

describe("Endpoint Playground defaults", () => {
  test("resolves every path placeholder and keeps search params separate", () => {
    for (const endpoint of endpoints) {
      const defaults = endpointRequestDefaults(endpoint);
      expect(defaults.path).toStartWith("/");
      expect(defaults.path).not.toContain("{");
      expect(defaults.path).not.toContain("?");
    }
    expect(sample("/anything/{path}").path).toBe("/anything/demo");
    expect(sample("/base64/{value}").path).toBe("/base64/aGVsbG8=");
    expect(sample("/status/{codes}").path).toBe("/status/418");
  });

  test("prefills documented query parameters without duplicating URL examples", () => {
    const redirect = sample("/redirect-to");
    expect(redirect.path).toBe("/redirect-to");
    expect(redirect.params).toEqual([
      { key: "url", value: "/get" },
      { key: "status_code", value: "302" },
    ]);
    expect(requestUrl(redirect)).toBe("/redirect-to?url=%2Fget&status_code=302");

    expect(sample("/download").params).toEqual([{ key: "filename", value: "hello.txt" }]);
    expect(sample("/get").params).toEqual([{ key: "hello", value: "world" }]);
    expect(sample("/cookies/delete").params).toEqual([{ key: "theme", value: "" }]);
    expect(sample("/response-headers").params).toEqual([{ key: "X-Test", value: "hello" }]);
    expect(sample("/bytes/{n}").params).toEqual([]);
    expect(sample("/stream-bytes/{n}").params).toEqual([
      { key: "chunk_size", value: "10240" },
      { key: "seed", value: "demo" },
    ]);
  });

  test("prefills header examples declared in endpoint metadata", () => {
    const endpoint: Endpoint = {
      method: "GET", path: "/get", group: "HTTP Methods",
      summary: "Custom header", description: "Header example",
      parameters: [{ name: "X-Demo", in: "header", description: "Test header", example: "hello" }],
    };
    expect(endpointRequestDefaults(endpoint).headers).toEqual([{ key: "X-Demo", value: "hello" }]);
  });

  test("provides working sample credentials for Basic and Bearer authentication", async () => {
    const basic = sample("/basic-auth/{user}/{passwd}");
    expect(basic.authType).toBe("basic");
    expect([basic.username, basic.password]).toEqual(["demo", "secret"]);
    const encoded = btoa(basic.username + ":" + basic.password);
    const basicResponse = await app.request(basic.path, { headers: { authorization: "Basic " + encoded } });
    expect(basicResponse.status).toBe(200);

    const bearer = sample("/bearer");
    expect(bearer.authType).toBe("bearer");
    expect(bearer.token).toBe("demo-token");
    const bearerResponse = await app.request(bearer.path, { headers: { authorization: "Bearer " + bearer.token } });
    expect(bearerResponse.status).toBe(200);

    expect(sample("/digest-auth/{qop}/{user}/{passwd}").authType).toBe("none");
  });

  test("prefills runnable RFC examples for Content-Digest and Prefer", async () => {
    const digest = sample("/digest/verify");
    expect(digest.method).toBe("POST");
    expect(digest.bodyMode).toBe("text");
    const digestHeaders = new Headers(digest.headers.map(({ key, value }) => [key, value]));
    const response = await app.request(requestUrl(digest), {
      method: digest.method,
      headers: digestHeaders,
      body: digest.body,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verified: true, algorithm: "sha-256", bytes: 5 });

    const prefer = sample("/prefer");
    expect(prefer.bodyMode).toBe("none");
    expect(prefer.headers).toEqual([{ key: "Prefer", value: "return=minimal" }]);
    const preferred = await app.request(prefer.path, {
      method: prefer.method,
      headers: Object.fromEntries(prefer.headers.map(({ key, value }) => [key, value])),
    });
    expect(preferred.status).toBe(204);
  });
});
