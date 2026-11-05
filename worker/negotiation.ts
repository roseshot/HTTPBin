type Range = { value: string; quality: number; order: number };

function parseWeights(header: string): Range[] {
  return header.split(",").map((part, order) => {
    const [value, ...parameters] = part.trim().split(";");
    const q = parameters.find((parameter) => /^\s*q\s*=/i.test(parameter));
    const raw = q?.split("=")[1]?.trim();
    const quality = raw === undefined ? 1 : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(raw) ? Number(raw) : 0;
    return { value: value.toLowerCase(), quality, order };
  }).filter((entry) => entry.value !== "");
}

export type ImageFormat = "png" | "jpeg" | "webp" | "svg";

const imageTypes: Record<ImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export function negotiateImage(accept: string | null): ImageFormat | null {
  if (accept === null || accept.trim() === "") return "png";
  const ranges = parseWeights(accept);
  let best: { format: ImageFormat; quality: number; specificity: number; order: number } | null = null;
  for (const format of ["png", "webp", "jpeg", "svg"] as const) {
    const mediaType = imageTypes[format];
    let selected: { quality: number; specificity: number; order: number } | null = null;
    for (const range of ranges) {
      const specificity = range.value === mediaType ? 2 : range.value === "image/*" ? 1 : range.value === "*/*" ? 0 : -1;
      if (specificity < 0) continue;
      if (!selected || specificity > selected.specificity || (specificity === selected.specificity && range.order < selected.order)) {
        selected = { quality: range.quality, specificity, order: range.order };
      }
    }
    if (!selected || selected.quality <= 0) continue;
    if (!best || selected.quality > best.quality || (selected.quality === best.quality && selected.specificity > best.specificity)) {
      best = { format, ...selected };
    }
  }
  return best?.format ?? null;
}

export function acceptsEncoding(header: string | null, encoding: string): boolean {
  if (header === null) return true;
  const ranges = parseWeights(header);
  const exact = ranges.find((range) => range.value === encoding);
  if (exact) return exact.quality > 0;
  const wildcard = ranges.find((range) => range.value === "*");
  return wildcard ? wildcard.quality > 0 : false;
}
