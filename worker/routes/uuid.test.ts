import { describe, expect, test } from "bun:test";
import app from "../index";
import { generateUuid, randomSubsecondTicks } from "../lib/uuid";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("UUID versions", () => {
  test("samples unbiased timestamp subticks with rejection", () => {
    const candidates = [65535, 60000, 59999];
    let draws = 0;
    expect(randomSubsecondTicks(() => candidates[draws++])).toBe(9999);
    expect(draws).toBe(3);

    const counts = new Uint8Array(10000);
    for (let sample = 0; sample < 60000; sample++) {
      counts[randomSubsecondTicks(() => sample)]++;
    }
    expect(counts.every((count) => count === 6)).toBe(true);
  });

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

