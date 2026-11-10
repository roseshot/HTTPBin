import { describe, expect, test } from "bun:test";
import { isUnexpectedHtmlResponse } from "./response-content";

describe("Unexpected HTML response classification", () => {
  test("hides HTML error pages and successful SPA fallbacks", () => {
    expect(isUnexpectedHtmlResponse("text/html; charset=utf-8", 404, "/missing")).toBe(true);
    expect(isUnexpectedHtmlResponse("TEXT/HTML", 200, "/get")).toBe(true);
    expect(isUnexpectedHtmlResponse("application/xhtml+xml", 502, "/html")).toBe(true);
    expect(isUnexpectedHtmlResponse("text/html", 200, "/wrong-endpoint")).toBe(true);
  });

  test("preserves HTML fixtures when the request succeeds", () => {
    for (const path of ["/html", "/links/5", "/forms/post"]) {
      expect(isUnexpectedHtmlResponse("text/html; charset=utf-8", 200, path)).toBe(false);
    }
    expect(isUnexpectedHtmlResponse("text/html", 404, "/html")).toBe(true);
  });

  test("does not mask ordinary API errors or text responses containing markup", () => {
    expect(isUnexpectedHtmlResponse("application/problem+json", 404, "/get")).toBe(false);
    expect(isUnexpectedHtmlResponse("text/plain", 500, "/get")).toBe(false);
    expect(isUnexpectedHtmlResponse("application/json", 200, "/get")).toBe(false);
  });
});
