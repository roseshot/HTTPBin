import { describe, expect, test } from "bun:test";
import app from "../index";

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

