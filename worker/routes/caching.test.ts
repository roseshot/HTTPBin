import { describe, expect, test } from "bun:test";
import app from "../index";

describe("Cache behavior", () => {
  test("preserves cache fixture directives and image caching", async () => {
    expect((await app.request("/cache")).headers.get("cache-control")).toBe("public, max-age=0");
    expect((await app.request("/cache/30")).headers.get("cache-control")).toBe("public, max-age=30");
    for (const path of ["/image/png", "/image/gif", "/image/avif", "/image/bmp", "/image/ico", "/image/svg"]) {
      expect((await app.request(path)).headers.get("cache-control")).toBe("public, max-age=3600");
    }
  });

  test("respects explicit response-headers cache directives", async () => {
    const response = await app.request("/response-headers?Cache-Control=public%2C%20max-age%3D60");
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
  });
});
