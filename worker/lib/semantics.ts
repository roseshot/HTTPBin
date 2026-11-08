export const LAST_MODIFIED = "Wed, 21 Oct 2015 07:28:00 GMT";

function tagsMatch(header: string, current: string, weak: boolean): boolean {
  if (header.trim() === "*") return true;
  const values = header.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  return values.some((part) => {
    const candidate = part.trim();
    if (!/^(?:W\/)?"[\x21\x23-\x7e]*"$/.test(candidate)) return false;
    if (!weak && (candidate.startsWith("W/") || current.startsWith("W/"))) return false;
    return candidate.replace(/^W\//, "") === current.replace(/^W\//, "");
  });
}

function validDate(value: string): number | null {
  const date = Date.parse(value);
  return Number.isFinite(date) ? date : null;
}

export function preconditionStatus(request: Request, etag: string, lastModified?: string): 304 | 412 | null {
  const method = request.method;
  const headers = request.headers;
  const ifMatch = headers.get("if-match");
  const unmodifiedSince = headers.get("if-unmodified-since");
  const ifNoneMatch = headers.get("if-none-match");
  const modifiedSince = headers.get("if-modified-since");

  if (ifMatch !== null) {
    if (!tagsMatch(ifMatch, etag, false)) return 412;
  } else if (unmodifiedSince !== null && lastModified) {
    const since = validDate(unmodifiedSince);
    if (since !== null && Date.parse(lastModified) > since) return 412;
  }

  if (ifNoneMatch !== null) {
    if (tagsMatch(ifNoneMatch, etag, true)) return method === "GET" || method === "HEAD" ? 304 : 412;
  } else if ((method === "GET" || method === "HEAD") && modifiedSince !== null && lastModified) {
    const since = validDate(modifiedSince);
    if (since !== null && Date.parse(lastModified) <= since) return 304;
  }
  return null;
}

export function ifRangeMatches(value: string, etag: string, lastModified: string): boolean {
  const candidate = value.trim();
  if (candidate.startsWith("W/")) return false;
  if (candidate.startsWith('"')) return candidate === etag && !etag.startsWith("W/");
  const date = validDate(candidate);
  return date !== null && date === Date.parse(lastModified);
}

export type ByteRange = { kind: "full" } | { kind: "unsatisfiable" } | { kind: "partial"; start: number; end: number };

export function selectByteRange(header: string | null, length: number): ByteRange {
  if (header === null) return { kind: "full" };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return { kind: "full" };
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) {
    return { kind: "full" };
  }
  if (first !== null && last !== null && last < first) return { kind: "full" };
  if (length === 0 || (first !== null && first >= length) || (first === null && last === 0)) {
    return { kind: "unsatisfiable" };
  }
  const start = first === null ? Math.max(0, length - (last as number)) : first;
  const end = first === null ? length - 1 : Math.min(last ?? length - 1, length - 1);
  return { kind: "partial", start, end };
}


export type SelectedByteRanges = ByteRange | { kind: "multipart"; parts: { start: number; end: number }[] };

// RFC 9110: limit range count and total represented bytes to avoid amplification.
export function selectByteRanges(header: string | null, length: number): SelectedByteRanges {
  if (header === null || !header.includes(",")) return selectByteRange(header, length);
  const trimmed = header.trim();
  if (!trimmed.startsWith("bytes=")) return { kind: "full" };
  const specs = trimmed.slice(6).split(",");
  if (specs.length < 2 || specs.length > 8) return { kind: "full" };
  const parts: { start: number; end: number }[] = [];
  let total = 0;
  for (const spec of specs) {
    const range = selectByteRange("bytes=" + spec.trim(), length);
    if (range.kind === "full") return { kind: "full" };
    if (range.kind === "unsatisfiable") continue;
    total += range.end - range.start + 1;
    if (total > 1024 * 1024) return { kind: "full" };
    parts.push({ start: range.start, end: range.end });
  }
  if (parts.length === 0) return { kind: "unsatisfiable" };
  if (parts.length === 1) return { kind: "partial", ...parts[0] };
  return { kind: "multipart", parts };
}
