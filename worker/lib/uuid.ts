import { md5Hex } from "./digest";

export type UuidVersion = 1 | 3 | 4 | 5 | 6 | 7 | 8;

const namespaces: Record<string, string> = {
  dns: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  url: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  oid: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
  x500: "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseUuidVersion(value: string | undefined): UuidVersion | null {
  if (value === undefined || value === "4") return 4;
  if (["1", "3", "5", "6", "7", "8"].includes(value)) return Number(value) as UuidVersion;
  return null;
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

function putInteger(bytes: Uint8Array, start: number, length: number, value: bigint): void {
  for (let index = length - 1; index >= 0; index--) {
    bytes[start + index] = Number(value & 255n);
    value >>= 8n;
  }
}

function nameBytes(namespace: string, name: string): Uint8Array {
  const identifier = namespaces[namespace.toLowerCase()] ?? namespace;
  if (!uuidPattern.test(identifier)) throw new Error("Namespace must be dns, url, oid, x500, or a UUID.");
  const prefix = Uint8Array.from(identifier.replace(/-/g, "").match(/.{2}/g)!, (hex) => Number.parseInt(hex, 16));
  const suffix = new TextEncoder().encode(name);
  if (suffix.byteLength > 4096) throw new Error("Name must not exceed 4096 UTF-8 bytes.");
  const input = new Uint8Array(16 + suffix.byteLength);
  input.set(prefix);
  input.set(suffix, 16);
  return input;
}

export function randomSubsecondTicks(
  draw: () => number = () => {
    const value = crypto.getRandomValues(new Uint16Array(1))[0];
    if (value === undefined) throw new Error("Unable to generate random subticks.");
    return value;
  },
): number {
  let candidate: number;
  do {
    candidate = draw();
  } while (candidate >= 60000);
  return candidate % 10000;
}

export async function generateUuid(version: UuidVersion, namespace?: string, name?: string): Promise<string> {
  if (version === 4) return crypto.randomUUID();
  const bytes = new Uint8Array(16);

  if (version === 3 || version === 5 || (version === 8 && namespace !== undefined && name !== undefined)) {
    if (namespace === undefined || name === undefined) throw new Error("A namespace and name are required.");
    const input = nameBytes(namespace, name);
    const digest = version === 3
      ? Uint8Array.from(md5Hex(input).match(/.{2}/g)!, (hex) => Number.parseInt(hex, 16))
      : new Uint8Array(await crypto.subtle.digest(version === 5 ? "SHA-1" : "SHA-256", new Uint8Array(input).buffer));
    bytes.set(digest.subarray(0, 16));
  } else if (version === 1 || version === 6) {
    const random = crypto.getRandomValues(new Uint8Array(8));
    const ticks = BigInt(Date.now()) * 10000n + 0x01b21dd213814000n +
      BigInt(randomSubsecondTicks());
    if (version === 1) {
      putInteger(bytes, 0, 4, ticks & 0xffffffffn);
      putInteger(bytes, 4, 2, (ticks >> 32n) & 0xffffn);
      putInteger(bytes, 6, 2, (ticks >> 48n) & 0x0fffn);
    } else {
      putInteger(bytes, 0, 4, ticks >> 28n);
      putInteger(bytes, 4, 2, (ticks >> 12n) & 0xffffn);
      putInteger(bytes, 6, 2, ticks & 0x0fffn);
    }
    bytes.set(random, 8);
    bytes[10] = (bytes[10] ?? 0) | 1;
  } else {
    crypto.getRandomValues(bytes);
    if (version === 7) putInteger(bytes, 0, 6, BigInt(Date.now()));
  }

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | (version << 4);
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return formatUuid(bytes);
}
