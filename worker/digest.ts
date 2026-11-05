import { encoder, error, json } from "./http";

export function md5Hex(input: string): string {
  const bytes = encoder.encode(input);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const lengthBits = BigInt(bytes.length) * 8n;
  for (let i = 0; i < 8; i++) padded[paddedLength - 8 + i] = Number((lengthBits >> BigInt(i * 8)) & 255n);

  const rotation = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const constants = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000));
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = new DataView(padded.buffer, offset, 64);
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const value = (a + f + constants[i] + words.getUint32(g * 4, true)) | 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((value << rotation[i]) | (value >>> (32 - rotation[i])))) | 0;
    }
    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }
  return [a0, b0, c0, d0].flatMap((word) =>
    [0, 8, 16, 24].map((shift) => ((word >>> shift) & 255).toString(16).padStart(2, "0")),
  ).join("");
}

async function hash(value: string, algorithm: "MD5" | "SHA-256"): Promise<string> {
  if (algorithm === "MD5") return md5Hex(value);
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseDigest(header: string): Record<string, string> {
  if (!/^Digest\s+/i.test(header)) return {};
  const values: Record<string, string> = Object.create(null);
  const pattern = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g;
  for (const match of header.slice(7).matchAll(pattern)) values[match[1].toLowerCase()] = match[2] ?? match[3];
  return values;
}

const NONCE_TTL = 5 * 60 * 1000;
const MAX_NONCES = 1024;
const nonces = new Map<string, { expires: number; counters: Map<string, number> }>();

function challenge(qop: string, algorithm: string, stale = false): Response {
  const now = Date.now();
  for (const [key, value] of nonces) if (value.expires <= now) nonces.delete(key);
  while (nonces.size >= MAX_NONCES) nonces.delete(nonces.keys().next().value!);
  const nonce = crypto.randomUUID();
  nonces.set(nonce, { expires: now + NONCE_TTL, counters: new Map() });
  const header = 'Digest realm="HTTPBin", nonce="' + nonce + '", qop="' + qop +
    '", algorithm=' + algorithm + ', charset=UTF-8' + (stale ? ', stale=true' : "");
  return new Response(null, { status: 401, headers: { "www-authenticate": header, "cache-control": "no-store" } });
}

export async function digestAuth(request: Request, qop: string, username: string, password: string, algorithmName = "SHA-256"): Promise<Response> {
  const algorithm = algorithmName.toUpperCase();
  if ((qop !== "auth" && qop !== "auth-int") || (algorithm !== "MD5" && algorithm !== "SHA-256")) {
    return error("Unsupported Digest authentication algorithm or quality of protection.");
  }
  const realm = "HTTPBin";
  const fields = parseDigest(request.headers.get("authorization") || "");
  if (!Object.keys(fields).length) return challenge(qop, algorithm);
  const uri = new URL(request.url).pathname + new URL(request.url).search;
  if (fields.username !== username || fields.realm !== realm ||
      fields.uri !== uri || fields.qop !== qop ||
      (fields.algorithm && fields.algorithm.toUpperCase() !== algorithm) ||
      !fields.cnonce || !/^[0-9a-fA-F]{8}$/.test(fields.nc || "") ||
      !/^[a-fA-F0-9]+$/.test(fields.response || "")) {
    return challenge(qop, algorithm);
  }

  const nonce = nonces.get(fields.nonce);
  if (!nonce || nonce.expires <= Date.now()) {
    nonces.delete(fields.nonce);
    return challenge(qop, algorithm, true);
  }

  const counter = Number.parseInt(fields.nc, 16);
  const last = nonce.counters.get(fields.cnonce) ?? 0;
  if (counter <= last) return challenge(qop, algorithm);

  const selected = algorithm as "MD5" | "SHA-256";
  const ha1 = await hash(username + ":" + realm + ":" + password, selected);
  const bodyHash = await hash("", selected);
  const ha2 = await hash(request.method + ":" + uri + (qop === "auth-int" ? ":" + bodyHash : ""), selected);
  const expected = await hash([ha1, fields.nonce, fields.nc, fields.cnonce, qop, ha2].join(":"), selected);
  if (fields.response.toLowerCase() !== expected) return challenge(qop, algorithm);

  nonce.counters.set(fields.cnonce, counter);
  return json({ authenticated: true, user: username });
}
