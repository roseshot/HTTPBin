export type Method = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "QUERY" | "ANY";
export type Group = "HTTP Methods" | "Request Inspection" | "Authentication" | "Status Codes" | "Redirects" | "Cookies" | "Response Formats" | "Dynamic Data" | "Streaming" | "Caching" | "Images" | "Utilities";
export interface Endpoint {
  method: Method;
  path: string;
  group: Group;
  summary: string;
  description: string;
  example?: string;
  parameters?: { name: string; in: "path" | "query" | "header"; description: string; required?: boolean; example?: string }[];
}
const q = (name: string, description: string, example?: string) => ({ name, in: "query" as const, description, example });
const p = (name: string, description: string, example?: string) => ({ name, in: "path" as const, required: true, description, example });
export const endpoints: Endpoint[] = [
  { method: "QUERY", path: "/query", group: "HTTP Methods", summary: "Safe, idempotent QUERY method", description: "RFC 10008 QUERY with a JSON request body and Accept-Query discovery. Requires Content-Type: application/json; the response is not cached.", example: "/query" },
  { method: "GET", path: "/digest/{algorithm}", group: "Response Formats", summary: "Generate Content-Digest", description: "RFC 9530 SHA-256 or SHA-512 Content-Digest and Repr-Digest of a fixed response body.", example: "/digest/sha-256", parameters: [p("algorithm", "sha-256 or sha-512", "sha-256")] },
  { method: "POST", path: "/digest/verify", group: "Response Formats", summary: "Verify Content-Digest", description: "Checks RFC 9530 Content-Digest against a request body (up to 1 MiB), returning 422 on mismatch.", parameters: [q("algorithm", "sha-256 or sha-512 (default sha-256)", "sha-256")] },
  { method: "POST", path: "/prefer", group: "Response Formats", summary: "Prefer minimal response", description: "RFC 7240: returns 204 for Prefer: return=minimal; otherwise a JSON representation with Preference-Applied." },
  { method: "GET", path: "/download", group: "Response Formats", summary: "Download with UTF-8 filename", description: "RFC 6266 and RFC 8187 Content-Disposition attachment response with an encoded UTF-8 filename.", example: "/download?filename=hello.txt", parameters: [q("filename", "Suggested file name", "hello.txt")] },
  { method: "GET", path: "/deprecation", group: "Caching", summary: "Deprecation and Sunset", description: "RFC 9745 structured Deprecation date and RFC 8594 Sunset response field, with a successor Link." },
  { method: "GET", path: "/links/header", group: "Utilities", summary: "Web Link relations", description: "RFC 8288 Link response field demonstrating next and previous pagination relations.", example: "/links/header?page=2", parameters: [q("page", "Page index (1-100)", "2")] },
  { method: "GET", path: "/structured-fields", group: "Response Formats", summary: "Structured field dictionary", description: "RFC 9651 Structured Fields Dictionary fixture with integer, Boolean, and Date items." },
  { method: "GET", path: "/get", group: "HTTP Methods", summary: "Inspect a GET request", description: "Returns the query parameters, headers, origin, and request URL.", example: "/get?hello=world" },
  { method: "POST", path: "/post", group: "HTTP Methods", summary: "Inspect a POST request", description: "Echoes JSON, form values, uploaded files, and raw body data." },
  { method: "PUT", path: "/put", group: "HTTP Methods", summary: "Inspect a PUT request", description: "Returns details of the submitted PUT request." },
  { method: "PATCH", path: "/patch", group: "HTTP Methods", summary: "Inspect a PATCH request", description: "Returns details of the submitted PATCH request." },
  { method: "DELETE", path: "/delete", group: "HTTP Methods", summary: "Inspect a DELETE request", description: "Returns details of the submitted DELETE request." },
  { method: "ANY", path: "/anything", group: "HTTP Methods", summary: "Echo any HTTP method", description: "Accepts any HTTP method and echoes the full request. Subpaths are supported.", example: "/anything/demo" },
  { method: "ANY", path: "/anything/{path}", group: "HTTP Methods", summary: "Inspect a request on a nested path", description: "Echoes supported HTTP methods on nested paths.", parameters: [p("path", "Nested path segment", "demo")] },
  { method: "GET", path: "/ip", group: "Request Inspection", summary: "Inspect client IP", description: "Returns the client IP address as seen by Cloudflare." },
  { method: "GET", path: "/headers", group: "Request Inspection", summary: "Inspect request headers", description: "Returns the headers received by the Worker." },
  { method: "GET", path: "/user-agent", group: "Request Inspection", summary: "Inspect user agent", description: "Returns the User-Agent header." },
  { method: "GET", path: "/basic-auth/{user}/{passwd}", group: "Authentication", summary: "HTTP Basic authentication", description: "Challenges Basic credentials and returns authentication status.", example: "/basic-auth/demo/secret", parameters: [p("user", "Expected username", "demo"), p("passwd", "Expected password", "secret")] },
  { method: "GET", path: "/hidden-basic-auth/{user}/{passwd}", group: "Authentication", summary: "Hidden Basic authentication", description: "Returns 404 rather than 401 for invalid credentials.", example: "/hidden-basic-auth/demo/secret", parameters: [p("user", "Expected username", "demo"), p("passwd", "Expected password", "secret")] },
  { method: "GET", path: "/digest-auth/{qop}/{user}/{passwd}", group: "Authentication", summary: "HTTP Digest authentication", description: "Challenges Digest credentials using SHA-256, a five-minute nonce, and the selected quality of protection. This is a test endpoint, not an authentication service.", example: "/digest-auth/auth/demo/secret", parameters: [p("qop", "Quality of protection: auth or auth-int", "auth"), p("user", "Expected username", "demo"), p("passwd", "Expected password", "secret")] },
  { method: "GET", path: "/digest-auth/{qop}/{user}/{passwd}/{algorithm}", group: "Authentication", summary: "Digest authentication algorithm", description: "Challenges HTTP Digest authentication using MD5 or SHA-256.", example: "/digest-auth/auth/demo/secret/SHA-256", parameters: [p("qop", "Quality of protection", "auth"), p("user", "Expected username", "demo"), p("passwd", "Expected password", "secret"), p("algorithm", "MD5 or SHA-256", "SHA-256")] },
  { method: "GET", path: "/bearer", group: "Authentication", summary: "Bearer authentication", description: "Tests RFC 6750 Bearer authorization syntax; accepts any nonempty token and does not authenticate identities." },
  { method: "GET", path: "/status/{codes}", group: "Status Codes", summary: "Return a status code", description: "Returns an HTTP status without inventing a redirect target. Informational statuses are unavailable in Fetch. Weighted alternatives are supported.", example: "/status/418", parameters: [p("codes", "HTTP status code or weighted codes", "418")] },
  { method: "GET", path: "/response-headers", group: "Response Formats", summary: "Set response headers", description: "Overrides response headers with query parameters. Unsafe framing and content-encoding headers are ignored.", example: "/response-headers?X-Test=hello" },
  { method: "GET", path: "/redirect/{n}", group: "Redirects", summary: "Redirect N times", description: "Returns a series of HTTP 302 responses.", example: "/redirect/3", parameters: [p("n", "Number of redirects (max 20)", "3")] },
  { method: "GET", path: "/relative-redirect/{n}", group: "Redirects", summary: "Relative redirects", description: "Redirects using a relative Location header.", example: "/relative-redirect/2", parameters: [p("n", "Number of redirects", "2")] },
  { method: "GET", path: "/absolute-redirect/{n}", group: "Redirects", summary: "Absolute redirects", description: "Redirects using an absolute Location URL.", example: "/absolute-redirect/2", parameters: [p("n", "Number of redirects", "2")] },
  { method: "GET", path: "/redirect-to", group: "Redirects", summary: "Redirect to URL", description: "Returns an HTTP redirect to the supplied URL.", example: "/redirect-to?url=%2Fget", parameters: [q("url", "Destination URL", "/get"), q("status_code", "Redirect status (301, 302, 303, 307, or 308)", "302")] },
  { method: "GET", path: "/cookies", group: "Cookies", summary: "Read cookies", description: "Returns cookies sent in the request." },
  { method: "GET", path: "/cookies/set", group: "Cookies", summary: "Set cookies", description: "Sets cookies from query parameters and redirects to /cookies.", example: "/cookies/set?theme=dark" },
  { method: "GET", path: "/cookies/delete", group: "Cookies", summary: "Delete cookies", description: "Expires cookies listed in the query parameters.", example: "/cookies/delete?theme" },
  { method: "GET", path: "/json", group: "Response Formats", summary: "Example JSON", description: "Returns a stable structured JSON example." },
  { method: "GET", path: "/html", group: "Response Formats", summary: "Example HTML", description: "Returns an HTML document." },
  { method: "GET", path: "/xml", group: "Response Formats", summary: "Example XML", description: "Returns an XML document." },
  { method: "GET", path: "/encoding/utf8", group: "Response Formats", summary: "UTF-8 response", description: "Returns a UTF-8 text/plain sample." },
  { method: "GET", path: "/gzip", group: "Response Formats", summary: "gzip encoded response", description: "Returns gzip-compressed JSON when permitted by Accept-Encoding and supported by the runtime." },
  { method: "GET", path: "/deflate", group: "Response Formats", summary: "deflate encoded response", description: "Returns deflate-compressed JSON when permitted by Accept-Encoding and supported by the runtime." },
  { method: "GET", path: "/brotli", group: "Response Formats", summary: "Brotli encoded response", description: "Returns Brotli output when permitted by Accept-Encoding and the runtime supports the encoder." },
  { method: "GET", path: "/uuid", group: "Dynamic Data", summary: "Generate UUID", description: "Returns a cryptographically random UUID." },
  { method: "GET", path: "/bytes/{n}", group: "Dynamic Data", summary: "Generate random bytes", description: "Returns up to 1 MiB of random bytes.", example: "/bytes/32", parameters: [p("n", "Number of bytes (max 1048576)", "32"), q("seed", "Optional deterministic seed")] },
  { method: "GET", path: "/base64/{value}", group: "Dynamic Data", summary: "Decode Base64", description: "Decodes Base64 and Base64URL data as octet-stream.", example: "/base64/aGVsbG8=", parameters: [p("value", "Base64 encoded value", "aGVsbG8=")] },
  { method: "GET", path: "/stream/{n}", group: "Streaming", summary: "Stream JSON lines", description: "Emits up to 100 application/x-ndjson records.", example: "/stream/10", parameters: [p("n", "Number of records (max 100)", "10")] },
  { method: "GET", path: "/stream-bytes/{n}", group: "Streaming", summary: "Stream random bytes", description: "Streams up to 1 MiB of random bytes. Seeded output is independent of chunk size.", example: "/stream-bytes/1024", parameters: [p("n", "Number of bytes (max 1048576)", "1024"), q("chunk_size", "Chunk size", "10240"), q("seed", "Optional deterministic seed", "demo")] },
  { method: "GET", path: "/drip", group: "Streaming", summary: "Drip response bytes", description: "Writes bytes incrementally after an optional delay.", example: "/drip?duration=2&numbytes=5", parameters: [q("duration", "Seconds spent streaming (max 10)", "2"), q("delay", "Initial delay in seconds (max 10)", "0"), q("numbytes", "Bytes emitted (max 100)", "5"), q("code", "HTTP status code", "200")] },
  { method: "GET", path: "/delay/{n}", group: "Streaming", summary: "Delay response", description: "Waits up to ten seconds before returning request details.", example: "/delay/2", parameters: [p("n", "Delay in seconds (max 10)", "2")] },
  { method: "GET", path: "/range/{n}", group: "Streaming", summary: "Byte range response", description: "Serves a deterministic byte pattern supporting single byte ranges, suffix ranges, If-Range, and conditional requests.", example: "/range/1024", parameters: [p("n", "Total number of bytes (max 1048576)", "1024")] },
  { method: "GET", path: "/cache", group: "Caching", summary: "Conditional caching", description: "Returns a stable cache test representation with ETag and Last-Modified validators, evaluated per RFC 9110." },
  { method: "GET", path: "/cache/{n}", group: "Caching", summary: "Cache for N seconds", description: "Returns a stable JSON representation with a public Cache-Control max-age directive; does not cache request-specific headers.", example: "/cache/30", parameters: [p("n", "Cache duration in seconds", "30")] },
  { method: "GET", path: "/etag/{etag}", group: "Caching", summary: "ETag validation", description: "Evaluates strong If-Match and weak If-None-Match comparison for conditional requests.", example: "/etag/demo", parameters: [p("etag", "Entity tag", "demo")] },
  { method: "GET", path: "/image", group: "Images", summary: "Negotiated image", description: "Negotiates an image representation using Accept quality and specificity; responds 406 when unacceptable." },
  { method: "GET", path: "/image/svg", group: "Images", summary: "SVG image", description: "Returns an SVG image." },
  { method: "GET", path: "/image/png", group: "Images", summary: "PNG image", description: "Returns a PNG image." },
  { method: "GET", path: "/image/jpeg", group: "Images", summary: "JPEG image", description: "Returns a JPEG image." },
  { method: "GET", path: "/image/webp", group: "Images", summary: "WebP image", description: "Returns a WebP image." },
  { method: "GET", path: "/links/{n}", group: "Utilities", summary: "HTML links", description: "Returns an HTML page with a set of internal links.", example: "/links/5", parameters: [p("n", "Number of links (max 100)", "5")] },
  { method: "GET", path: "/forms/post", group: "Utilities", summary: "HTML form", description: "Returns an HTML form that posts to /post." },
  { method: "GET", path: "/robots.txt", group: "Utilities", summary: "Robots policy", description: "Returns robots.txt." },
  { method: "GET", path: "/deny", group: "Utilities", summary: "Permission denied example", description: "Returns a simple access denied message." },
];
export const groups: Group[] = [...new Set(endpoints.map((endpoint) => endpoint.group))];
