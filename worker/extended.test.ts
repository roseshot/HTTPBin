import { describe, expect, test } from "bun:test";
import app from "./index";
import { generateUuid } from "./uuid";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("UUID versions", () => {
  for (const version of [1, 3, 4, 5, 6, 7, 8]) {
    test(`serves RFC 9562 UUID version ${version}`, async () => {
      const suffix = version === 3 || version === 5 ? "?namespace=dns&name=python.org" : "";
      const response = await app.request(`/uuid/${version}${suffix}`);
      expect(response.status).toBe(200);
      const { uuid } = await response.json() as { uuid: string };
      expect(uuid).toMatch(uuidPattern);
      expect(uuid[14]).toBe(String(version));
      expect("89ab").toContain(uuid[19]);
    });
  }

  test("keeps version 4 as the default and supports the version query parameter", async () => {
    const legacy = await (await app.request("/uuid")).json() as { uuid: string };
    expect(legacy.uuid[14]).toBe("4");
    const query = await (await app.request("/uuid?version=7")).json() as { uuid: string };
    expect(query.uuid[14]).toBe("7");
    const timestamp = Number.parseInt(query.uuid.slice(0, 8) + query.uuid.slice(9, 13), 16);
    expect(Math.abs(timestamp - Date.now())).toBeLessThan(10000);
  });

  test("matches RFC name-based UUID values and normalizes namespace aliases", async () => {
    expect(await generateUuid(3, "dns", "python.org")).toBe("6fa459ea-ee8a-3ca4-894e-db77e160355e");
    expect(await generateUuid(5, "dns", "python.org")).toBe("886313e1-3b8a-5372-9b90-0c9aee199e5d");
    expect(await generateUuid(5, "6ba7b810-9dad-11d1-80b4-00c04fd430c8", "python.org"))
      .toBe("886313e1-3b8a-5372-9b90-0c9aee199e5d");
  });

  test("supports deterministic SHA-256 version 8 and random version 8", async () => {
    const first = await generateUuid(8, "url", "https://example.org");
    expect(await generateUuid(8, "url", "https://example.org")).toBe(first);
    expect(first[14]).toBe("8");
    const random = await (await app.request("/uuid/8")).json() as { uuid: string };
    expect(random.uuid[14]).toBe("8");
  });

  test("rejects unsupported versions and invalid name-based parameters", async () => {
    expect((await app.request("/uuid/2")).status).toBe(400);
    expect((await app.request("/uuid?version=9")).status).toBe(400);
    expect((await app.request("/uuid/3")).status).toBe(400);
    expect((await app.request("/uuid/5?namespace=dns")).status).toBe(400);
    expect((await app.request("/uuid/3?namespace=invalid&name=example")).status).toBe(400);
    expect((await app.request("/uuid/8?namespace=dns")).status).toBe(400);
    expect((await app.request("/uuid/5?namespace=dns&name=" + "a".repeat(4097))).status).toBe(400);
  });
});

describe("Additional image formats", () => {
  for (const [format, mime] of [
    ["gif", "image/gif"],
    ["avif", "image/avif"],
    ["bmp", "image/bmp"],
    ["ico", "image/x-icon"],
  ] as const) {
    test(`serves valid ${format.toUpperCase()} fixtures`, async () => {
      const response = await app.request("/image/" + format);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(mime);
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect(bytes.byteLength).toBeGreaterThan(100);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (format === "gif") {
        expect(new TextDecoder().decode(bytes.subarray(0, 6))).toMatch(/^GIF8[79]a$/);
        expect(view.getUint16(6, true)).toBe(180);
        expect(view.getUint16(8, true)).toBe(120);
      } else if (format === "avif") {
        expect(new TextDecoder().decode(bytes.subarray(4, 12))).toBe("ftypavif");
        const marker = new TextEncoder().encode("ispe");
        const offset = bytes.findIndex((byte, index) => marker.every((value, i) => bytes[index + i] === value));
        expect(offset).toBeGreaterThan(0);
        expect(view.getUint32(offset + 8)).toBe(180);
        expect(view.getUint32(offset + 12)).toBe(120);
      } else if (format === "bmp") {
        expect(new TextDecoder().decode(bytes.subarray(0, 2))).toBe("BM");
        expect(view.getUint32(2, true)).toBe(bytes.byteLength);
        expect(view.getInt32(18, true)).toBe(180);
        expect(view.getInt32(22, true)).toBe(120);
      } else {
        expect(Array.from(bytes.subarray(0, 4))).toEqual([0, 0, 1, 0]);
        expect(bytes[6]).toBe(64);
        expect(bytes[7]).toBe(64);
      }
    });
  }

  test("negotiates modern images and recognizes ICO media types", async () => {
    for (const [accept, mime] of [
      ["image/gif", "image/gif"],
      ["image/avif", "image/avif"],
      ["image/bmp", "image/bmp"],
      ["image/x-icon", "image/x-icon"],
      ["image/vnd.microsoft.icon", "image/x-icon"],
    ]) {
      const response = await app.request("/image", { headers: { accept } });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(mime);
      expect(response.headers.get("vary")).toBe("Accept");
    }
  });

  test("preserves legacy formats and rejects unsupported image types", async () => {
    expect((await app.request("/image/png")).status).toBe(200);
    expect((await app.request("/image/jpeg")).status).toBe(200);
    expect((await app.request("/image/webp")).status).toBe(200);
    expect((await app.request("/image/svg")).status).toBe(200);
    expect((await app.request("/image/unsupported")).status).toBe(404);
    const response = await app.request("/image", { headers: { accept: "application/json" } });
    expect(response.status).toBe(406);
  });
});

describe("Site-wide no-store headers", () => {
  for (const path of [
    "/", "/get", "/uuid", "/uuid/7", "/image/png", "/image/gif", "/image/avif",
    "/cache", "/cache/3600", "/etag/test", "/redirect/1",
    "/status/418", "/missing", "/openapi.json", "/response-headers?Cache-Control=public%2C%20max-age%3D3600",
  ]) {
    test(`disables caching for ${path}`, async () => {
      const response = await app.request(path);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("cdn-cache-control")).toBe("no-store");
      expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("no-store");
    });
  }

  test("disables caching for HEAD, OPTIONS and conditional responses", async () => {
    const head = await app.request("/image/png", { method: "HEAD" });
    const options = await app.request("/uuid/7", { method: "OPTIONS" });
    const conditional = await app.request("/cache", { headers: { "if-none-match": '"http-cache-v1"' } });
    expect(head.headers.get("cache-control")).toBe("no-store");
    expect(options.headers.get("cache-control")).toBe("no-store");
    expect(conditional.status).toBe(304);
    expect(conditional.headers.get("cache-control")).toBe("no-store");
  });

  test("configures static assets with no-store response headers", async () => {
    const headers = await Bun.file(new URL("../public/_headers", import.meta.url)).text();
    expect(headers).toContain("/*");
    for (const header of ["Cache-Control", "CDN-Cache-Control", "Cloudflare-CDN-Cache-Control"]) {
      expect(headers).toContain(header + ": no-store");
    }
  });
});
