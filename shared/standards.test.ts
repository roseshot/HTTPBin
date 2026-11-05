import { describe, expect, test } from "bun:test";
import { coverageLabels, rfcUrl, standards, unsupportedCapabilities } from "./standards";

describe("RFC coverage catalog", () => {
  test("uses distinct RFC references with explicit support boundaries", () => {
    expect(new Set(standards.map((standard) => standard.rfc)).size).toBe(standards.length);
    for (const standard of standards) {
      expect(rfcUrl(standard.rfc)).toBe(`https://www.rfc-editor.org/rfc/rfc${standard.rfc}.html`);
      expect(standard.title.length).toBeGreaterThan(0);
      expect(standard.implemented.length).toBeGreaterThan(0);
      expect(standard.missing.length).toBeGreaterThan(0);
      expect(coverageLabels[standard.level].length).toBeGreaterThan(0);
    }
  });

  test("distinguishes implemented subsets, demonstrations, and runtime controls", () => {
    expect(new Set(standards.map((standard) => standard.level))).toEqual(new Set(["subset", "demonstration", "runtime"]));
    expect(standards.find((standard) => standard.rfc === 6750)?.level).toBe("demonstration");
    expect(standards.find((standard) => standard.rfc === 9113)?.level).toBe("runtime");
    expect(unsupportedCapabilities.length).toBeGreaterThan(0);
  });
});
