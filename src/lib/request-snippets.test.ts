import { describe, expect, test } from "bun:test";
import { formatRequest, requestTools } from "./request-snippets";

function request(overrides: Partial<Parameters<typeof formatRequest>[1]> = {}) {
  return {
    url: new URL("https://example.com/post?name=first&name=second"),
    method: "POST",
    headers: new Headers({ "content-type": "application/json", "x-demo": "O'Reilly" }),
    payload: '{"message":"hello"}',
    followRedirects: true,
    ...overrides,
  };
}

describe("Request snippets", () => {
  test("offers cURL, HTTPie, JavaScript Fetch, and Python Requests", () => {
    expect(requestTools.map(({ id }) => id)).toEqual(["curl", "httpie", "fetch", "python"]);
  });

  test("escapes shell values and follows redirects in cURL", () => {
    const snippet = formatRequest("curl", request());
    expect(snippet).toMatch(/^curl -i -X POST /);
    expect(snippet).toContain("'https://example.com/post?name=first&name=second'");
    expect(snippet).toContain("'x-demo: O'\\''Reilly'");
    expect(snippet).toContain("--data-raw");
    expect(snippet).toContain("-L");
    expect(formatRequest("curl", request({ followRedirects: false }))).not.toContain(" -L");
  });

  test("uses HTTPie request syntax for headers and raw bodies", () => {
    const snippet = formatRequest("httpie", request({ followRedirects: false }));
    expect(snippet).toMatch(/^http --print=hb POST /);
    expect(snippet).toContain("'content-type:application/json'");
    expect(snippet).toContain("--raw");
    expect(snippet).not.toContain("--follow");
    expect(formatRequest("httpie", request())).toContain("--follow");
  });

  test("generates executable JavaScript for JSON and URL-encoded bodies", () => {
    const json = formatRequest("fetch", request());
    expect(json).toContain('await fetch("https://example.com/post?name=first&name=second"');
    expect(json).toContain('redirect: "follow"');
    expect(json).toContain('body: "{\\"message\\":\\"hello\\"}"');
    const encoded = formatRequest("fetch", request({
      payload: new URLSearchParams([["name", "one"], ["name", "two"]]),
      headers: new Headers({ "content-type": "application/x-www-form-urlencoded" }),
    }));
    expect(encoded).toContain('new URLSearchParams("name=one&name=two")');
  });

  test("generates Python Requests snippets with explicit redirect handling", () => {
    const snippet = formatRequest("python", request({ followRedirects: false }));
    expect(snippet).toMatch(/^import requests\n\nresponse = requests.request\(/);
    expect(snippet).toContain('allow_redirects=False');
    expect(snippet).toContain('data="{\\"message\\":\\"hello\\"}"');
    expect(formatRequest("python", request())).toContain('allow_redirects=True');
  });

  test("handles text-only multipart fields without treating @ as file input", () => {
    const form = new FormData();
    form.append("upload", "@not-a-file");
    form.append("message", "a' b");
    const input = request({ payload: form, headers: new Headers() });
    const curl = formatRequest("curl", input);
    expect(curl).toContain("--form-string");
    expect(curl).not.toContain(" -F ");
    const httpie = formatRequest("httpie", input);
    expect(httpie).toContain("--form --multipart");
    const fetch = formatRequest("fetch", input);
    expect(fetch).toContain('form.append("upload", "@not-a-file");');
    expect(fetch).toContain("body: form");
    const python = formatRequest("python", input);
    expect(python).toContain('files=[("upload", (None, "@not-a-file"))');
  });

  test("omits request bodies when none were configured", () => {
    const input = request({ method: "GET", payload: undefined });
    expect(formatRequest("curl", input)).not.toContain("--data-raw");
    expect(formatRequest("fetch", input)).not.toContain("body:");
    expect(formatRequest("python", input)).not.toContain("data=");
  });
});
