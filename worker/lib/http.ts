import { problem } from "./protocol";

export const MAX_BYTES = 1024 * 1024;
export const encoder = new TextEncoder();

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data, null, 2) + "\n", {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...Object.fromEntries(new Headers(headers)) },
  });
}

export function error(message: string, status = 400): Response {
  return problem(message, status);
}

export function intParam(value: string | undefined, maximum: number, minimum = 0): number | null {
  if (value === undefined || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null;
}

export function seconds(value: string | null | undefined, fallback = 0): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(n, 10)) : fallback;
}

export function queryObject(url: URL): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = Object.create(null);
  for (const [key, value] of url.searchParams) {
    if (!(key in result)) result[key] = value;
    else if (Array.isArray(result[key])) (result[key] as string[]).push(value);
    else result[key] = [result[key] as string, value];
  }
  return result;
}

export function headersObject(headers: Headers): Record<string, string> {
  return Object.fromEntries([...headers].map(([key, value]) => [key.replace(/(^|-)([a-z])/g, (_, sep: string, letter: string) => sep + letter.toUpperCase()), value]));
}

export function origin(request: Request): string {
  return request.headers.get("cf-connecting-ip") || "unknown";
}

export function requestInfo(request: Request): { args: Record<string, string | string[]>; headers: Record<string, string>; origin: string; url: string } {
  const url = new URL(request.url);
  return { args: queryObject(url), headers: headersObject(request.headers), origin: origin(request), url: request.url };
}

export async function inspect(request: Request): Promise<Response> {
  const info = requestInfo(request);
  const result: Record<string, unknown> = { ...info, data: "", files: {}, form: {}, json: null };
  if (request.method === "GET" || request.method === "HEAD") return json(result);
  const sizeHeader = Number(request.headers.get("content-length") || 0);
  if (sizeHeader > MAX_BYTES) return error("Request body exceeds the 1 MiB limit.", 413);
  const reader = request.body?.getReader();
  if (!reader) return json(result);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return error("Request body exceeds the 1 MiB limit.", 413);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const contentType = request.headers.get("content-type") || "";
  const text = new TextDecoder().decode(bytes);
  result.data = text;
  if (/\bjson\b|\+json\b/i.test(contentType)) {
    try { result.json = JSON.parse(text); } catch { /* Invalid JSON is still valid test input. */ }
  }
  if (/application\/x-www-form-urlencoded|multipart\/form-data/i.test(contentType)) {
    try {
      const form = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: bytes }).formData();
      const values: Record<string, string | string[]> = {};
      const files: Record<string, string> = {};
      for (const [key, field] of form.entries()) {
        const value: unknown = field;
        if (value instanceof Blob) {
          const content = new Uint8Array(await value.arrayBuffer());
          const mime = value.type || "application/octet-stream";
          if (mime.startsWith("text/") || /^(application\/(?:json|xml|javascript))$/.test(mime)) {
            files[key] = new TextDecoder().decode(content);
          } else {
            let binary = "";
            for (const chunk of Array.from({ length: Math.ceil(content.length / 8192) }, (_, index) => content.subarray(index * 8192, (index + 1) * 8192))) {
              binary += String.fromCharCode(...chunk);
            }
            files[key] = "data:" + mime + ";base64," + btoa(binary);
          }
        } else if (typeof value !== "string") continue;
        else if (!(key in values)) values[key] = value;
        else if (Array.isArray(values[key])) (values[key] as string[]).push(value);
        else values[key] = [values[key] as string, value];
      }
      result.form = values;
      result.files = files;
      if (/application\/x-www-form-urlencoded/i.test(contentType)) result.data = "";
      if (/multipart\/form-data/i.test(contentType)) result.data = "";
    } catch { /* Invalid multipart bodies are echoed as raw data. */ }
  } else if (bytes.length && !/^(text\/|application\/(?:json|xml|javascript))/i.test(contentType)) {
    result.data = "data:" + (contentType.split(";")[0] || "application/octet-stream") + ";base64," + btoa(Array.from({ length: Math.ceil(bytes.length / 8192) }, (_, i) => String.fromCharCode(...bytes.subarray(i * 8192, (i + 1) * 8192))).join(""));
  }
  return json(result);
}

export function randomBytes(count: number, seed?: string): Uint8Array {
  const bytes = new Uint8Array(count);
  if (seed === undefined) {
    for (let start = 0; start < count; start += 65536) crypto.getRandomValues(bytes.subarray(start, Math.min(count, start + 65536)));
  } else {
    let state = 2166136261;
    for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
    for (let i = 0; i < count; i++) {
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      bytes[i] = state & 255;
    }
  }
  return bytes;
}

export function streamed(produce: (controller: ReadableStreamDefaultController<Uint8Array>) => Promise<void> | void, type: string, status = 200, headers?: HeadersInit): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      void Promise.resolve().then(() => produce(controller)).then(
        () => controller.close(),
        (cause: unknown) => controller.error(cause),
      );
    },
  });
  return new Response(stream, { status, headers: { "content-type": type, "cache-control": "no-store", ...Object.fromEntries(new Headers(headers)) } });
}

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}
