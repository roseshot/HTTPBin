/**
 * Keep HTML source visible for documented HTML fixtures, but do not show
 * error pages or accidental SPA fallback documents in the API Playground.
 */
export function isUnexpectedHtmlResponse(contentType: string, status: number, requestedPath: string): boolean {
  const mime = contentType.split(";", 1)[0]?.trim().toLowerCase();
  if (mime !== "text/html" && mime !== "application/xhtml+xml") return false;
  if (status < 200 || status >= 300) return true;
  return requestedPath !== "/html" && requestedPath !== "/forms/post" && !/^\/links\/\d+$/.test(requestedPath);
}
