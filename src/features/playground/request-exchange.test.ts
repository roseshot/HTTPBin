import { describe, expect, test } from "bun:test";
import { captureRequest, formatExchange } from "./request-exchange";
import type { Result } from "./types";

function response(overrides: Partial<Result> = {}): Result {
  return {
    status: 200, statusText: "OK", elapsed: 14,
    headers: [["content-type", "application/json"], ["location", "https://example.com/next"]],
    text: '{"url":"https://example.com/post","ok":true}',
    bytes: 48, contentType: "application/json", finalUrl: "https://example.com/post",
    redirected: false, chunks: 1, timeline: [],
    ...overrides,
  };
}

describe("Request and response clipboard formatting", () => {
  test("copies one complete exchange with relative URLs and no origin", () => {
    const request = captureRequest(
      new URL("https://example.com/post?name=first&name=second"),
      "POST",
      new Headers({ "content-type": "application/json", host: "example.com", "x-demo": "hello" }),
      '{"message":"hello","next":"https://example.com/next"}',
    );
    const output = formatExchange(request, response());
    expect(output).toStartWith("=== REQUEST ===\nPOST /post?name=first&name=second");
    expect(output).toContain('content-type: application/json');
    expect(output).toContain('"message":"hello"');
    expect(output).toContain("=== RESPONSE ===\n200 OK");
    expect(output).toContain("location: /next");
    expect(output).toContain('"url":"/post"');
    expect(output).not.toContain("example.com");
    expect(output).not.toContain("https://");
    expect(output).not.toContain("host:");
  });

  test("captures URL encoded and multipart request fields", () => {
    const url = new URL("https://example.com/post");
    const encoded = captureRequest(url, "POST", new Headers(), new URLSearchParams([["name", "one"], ["name", "two"]]));
    expect(formatExchange(encoded, response())).toContain("name=one&name=two");

    const fields = new FormData();
    fields.append("name", "Alice");
    fields.append("name", "Bob");
    const form = captureRequest(url, "POST", new Headers(), fields);
    expect(form.body).toContain('"name": "name"');
    expect(form.body).toContain('"value": "Alice"');
    expect(form.body).toContain('"value": "Bob"');
  });

  test("handles missing bodies, binary replies, and concealed HTML error pages", () => {
    const request = captureRequest(new URL("https://example.com/bytes/4"), "GET", new Headers());
    const binary = formatExchange(request, response({
      contentType: "application/octet-stream",
      text: "",
      bytes: 4,
    }));
    expect(binary).toContain("[Binary response: 4 bytes]");
    expect(binary).not.toContain("undefined");

    const html = formatExchange(request, response({
      status: 404, statusText: "Not Found",
      contentType: "text/html",
      text: "<!doctype html><html><body>error</body></html>",
      unexpectedHtml: true,
    }));
    expect(html).toContain("[Unexpected HTML response omitted]");
    expect(html).not.toContain("<html>");
  });

  test("omits host names but preserves ordinary content", () => {
    const request = captureRequest(
      new URL("https://example.com/get?q=https%3A%2F%2Fother.test%2Fx"),
      "GET",
      new Headers({ "x-test": "example.com" }),
    );
    const output = formatExchange(request, response({
      text: '{"website":"https://other.test/page","title":"An example"}',
    }));
    expect(output).toContain('"website":"/page"');
    expect(output).toContain('"title":"An example"');
    expect(output).not.toContain("example.com");
    expect(output).not.toContain("other.test/page");
  });
});
