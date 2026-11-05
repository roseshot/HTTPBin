import { describe, expect, test } from "bun:test";
import { DEFAULT_LOCALE, RTL_LOCALES, english, locales, matchLocale, resolveLocale, translate, type MessageKey } from "./schema";
import { loadLocale } from "./index";

describe("web interface localization", () => {
  test("registers 18 distinct languages with English as default", () => {
    expect(locales.length).toBe(18);
    expect(new Set(locales.map((locale) => locale.code)).size).toBe(18);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(RTL_LOCALES).toEqual(["ar"]);
  });

  test("handles language region tags and traditional Chinese", () => {
    expect(matchLocale("zh-Hant-HK")).toBe("zh-TW");
    expect(matchLocale("zh-Hans-SG")).toBe("zh-CN");
    expect(matchLocale("pt-PT")).toBe("pt-BR");
    expect(matchLocale("en-US")).toBe("en");
    expect(matchLocale("xx-ZZ")).toBeNull();
  });

  test("prefers explicit URL language over stored and browser preferences", () => {
    expect(resolveLocale("fr", "ja", ["en-US"])).toBe("fr");
    expect(resolveLocale("not-real", "ja", ["de-DE"])).toBe("ja");
    expect(resolveLocale(null, null, ["xx", "ko-KR"])).toBe("ko");
    expect(resolveLocale(null, null, ["xx"])).toBe("en");
  });

  test("loads distinct non-English translations and falls back safely", async () => {
    const bundles = await Promise.all(locales.map(async ({ code }) => ({ code, messages: await loadLocale(code) })));
    for (const { code, messages } of bundles) {
      expect(translate("apiExplorer", messages).length).toBeGreaterThan(0);
      expect(translate("send", messages).length).toBeGreaterThan(0);
      expect(translate("rfcTitle", messages).length).toBeGreaterThan(0);
      expect(translate("groupMethods", messages).length).toBeGreaterThan(0);
      for (const key of Object.keys(english) as MessageKey[]) {
        expect(messages[key]).toBeDefined();
        expect(typeof messages[key]).toBe("string");
        expect(messages[key]?.trim().length).toBeGreaterThan(0);
      }
      if (code !== "en") expect(translate("language", messages)).not.toBe(english.language);
    }
    expect(translate("apiExplorer", { apiExplorer: "" })).toBe(english.apiExplorer);
    expect(translate("errorRequest" as MessageKey, {})).toBe(english.errorRequest);
  });
});
