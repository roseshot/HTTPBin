import type { Result } from "./types";

export interface CapturedRequest {
  method: string;
  path: string;
  headers: [string, string][];
  body: string | null;
  origin: string;
}

/** Capture the request at send time so later editor changes do not affect the copied exchange. */
export function captureRequest(url: URL, method: string, headers: Headers, payload?: BodyInit): CapturedRequest {
  let body: string | null = null;
  if (typeof payload === "string") body = payload;
  else if (payload instanceof URLSearchParams) body = payload.toString();
  else if (payload instanceof FormData) {
    body = JSON.stringify(Array.from(payload, ([name, value]) => ({
      name,
      value: typeof value === "string" ? value : "[file: " + value.name + "]",
    })), null, 2);
  } else if (payload !== undefined) body = "[Binary request body]";

  return {
    method,
    path: url.pathname + url.search,
    headers: Array.from(headers.entries()),
    body,
    origin: url.origin,
  };
}

/** Remove URL authorities while leaving path/query components and other response details intact. */
function omitDomains(value: string, origin: string): string {
  const host = new URL(origin).host;
  return value
    .replaceAll(origin, "")
    .replace(/https?:\/\/[^\s/?#"'<>\\]+/gi, "")
    .replace(/https?%3a%2f%2f[^\s%/?#&"'<>\\]+/gi, "")
    .replaceAll(host, "[domain omitted]");
}

function formatHeaders(headers: [string, string][], origin: string): string[] {
  return headers
    .filter(([name]) => name.toLowerCase() !== "host" && name.toLowerCase() !== ":authority")
    .map(([name, value]) => name + ": " + omitDomains(value, origin));
}

export function formatExchange(request: CapturedRequest, response: Result): string {
  const requestLines = [
    "=== REQUEST ===",
    request.method + " " + omitDomains(request.path, request.origin),
    ...formatHeaders(request.headers, request.origin),
  ];
  if (request.body !== null) requestLines.push("", omitDomains(request.body, request.origin));

  const isBinary = response.contentType.toLowerCase().startsWith("image/") ||
    (!response.contentType.includes("text/") && !response.contentType.includes("json") &&
      !response.contentType.includes("xml") && !response.contentType.includes("javascript"));
  const body = response.unexpectedHtml ? "[Unexpected HTML response omitted]" :
    isBinary ? "[Binary response: " + response.bytes + " bytes]" : response.text || "(empty response body)";

  return [
    ...requestLines,
    "",
    "=== RESPONSE ===",
    String(response.status || "Opaque") + (response.statusText ? " " + response.statusText : ""),
    ...formatHeaders(response.headers, request.origin),
    "",
    omitDomains(body, request.origin),
  ].join("\n");
}
