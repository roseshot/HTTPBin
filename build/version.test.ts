import { describe, expect, test } from "bun:test";
import { resolveBuildVersion } from "./version";

describe("Git build version", () => {
  test("shows the tag for a tagged build", () => {
    expect(resolveBuildVersion({ tag: "v1.2.0", sha: "abcdef0123456789" })).toBe("v1.2.0");
    expect(resolveBuildVersion({ describe: () => "v1.2.0\n" })).toBe("v1.2.0");
  });

  test("distinguishes commits after the most recent tag", () => {
    expect(resolveBuildVersion({ describe: () => "v1.2.0-3-gabc1234" })).toBe("v1.2.0-3-gabc1234");
  });

  test("falls back to a short commit SHA or dev when Git metadata is absent", () => {
    expect(resolveBuildVersion({ sha: "abcdef0123456789", describe: () => { throw new Error("no git"); } })).toBe("abcdef0");
    expect(resolveBuildVersion({ sha: "1234567890" })).toBe("1234567");
    expect(resolveBuildVersion({})).toBe("dev");
  });
});
