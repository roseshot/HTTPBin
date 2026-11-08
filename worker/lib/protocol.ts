import { MAX_BYTES } from "./http";

// RFC 9651 Byte Sequence Dictionary subset used by RFC 9530.
export type DigestAlgorithm = "sha-256" | "sha-512";
const digestLengths: Record<DigestAlgorithm, number> = { "sha-256": 32, "sha-512": 64 };

export function parseDigestDictionary(header: string): Map<string, Uint8Array> | null {
  if (header.length > 4096) return null;
  const result = new Map<string, Uint8Array>();
  let pos = 0;
  while (pos < header.length) {
    while (header[pos] === " " || header[pos] === "\t") pos++;
    const match = /^([a-z*][a-z0-9_.*-]*)=:([A-Za-z0-9+/]*={0,2}):/.exec(header.slice(pos));
    if (!match) return null;
    const [raw, key, encoded] = match;
    if (result.has(key) || encoded.length % 4 === 1) return null;
    let bytes: Uint8Array;
    try {
      const decoded = atob(encoded);
      bytes = Uint8Array.from(decoded, (letter) => letter.charCodeAt(0));
      if (btoa(decoded).replace(/=+$/, "") !== encoded.replace(/=+$/, "")) return null;
    } catch { return null; }
    result.set(key, bytes);
    pos += raw.length;
    while (header[pos] === " " || header[pos] === "\t") pos++;
    if (pos === header.length) break;
    if (header[pos] !== ",") return null;
    pos++;
    while (header[pos] === " " || header[pos] === "\t") pos++;
    if (pos >= header.length) return null;
  }
  return result.size ? result : null;
}

export async function digestBytes(bytes: Uint8Array<ArrayBuffer>, algorithm: DigestAlgorithm): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest(algorithm === "sha-256" ? "SHA-256" : "SHA-512", bytes);
  return new Uint8Array(hash);
}

export function digestField(algorithm: DigestAlgorithm, digest: Uint8Array): string {
  let raw = "";
  for (const value of digest) raw += String.fromCharCode(value);
  return algorithm + "=:" + btoa(raw) + ":";
}

export function matchDigestField(header: string, actual: Uint8Array, algorithm: DigestAlgorithm): "match" | "mismatch" | "invalid" {
  const map = parseDigestDictionary(header);
  if (!map) return "invalid";
  const expected = map.get(algorithm);
  if (!expected || expected.length !== digestLengths[algorithm]) return "invalid";
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected[index] ^ actual[index];
  return difference === 0 ? "match" : "mismatch";
}

export async function boundedBody(request: Request): Promise<Uint8Array<ArrayBuffer> | Response> {
  if (Number(request.headers.get("content-length") || 0) > MAX_BYTES) return problem("Request content exceeds 1 MiB.", 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return problem("Request content exceeds 1 MiB.", 413);
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

const titles: Record<number, string> = {
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
  405: "Method Not Allowed", 406: "Not Acceptable", 409: "Conflict",
  412: "Precondition Failed", 413: "Content Too Large", 415: "Unsupported Media Type",
  422: "Unprocessable Content", 428: "Precondition Required",
  429: "Too Many Requests", 500: "Internal Server Error", 501: "Not Implemented",
};

export function problem(detail: string, status = 400, headers?: HeadersInit): Response {
  return new Response(JSON.stringify({
    type: "about:blank",
    title: titles[status] ?? "HTTP Error",
    status,
    detail,
  }) + "\n", {
    status,
    headers: {
      "content-type": "application/problem+json",
      "cache-control": "no-store",
      ...Object.fromEntries(new Headers(headers)),
    },
  });
}

export function preferMinimal(value: string | null): boolean {
  if (!value) return false;
  return value.split(",").some((part) => /^return\s*=\s*(?:"minimal"|minimal)(?:\s*(?:;.*)?)?$/i.test(part.trim()));
}

export const ACCEPT_QUERY = '"application/json"';
