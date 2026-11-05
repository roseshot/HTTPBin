# HTTP Semantics Contract

HTTPBin Workers is an HTTP test fixture and request inspector, not a byte-for-byte clone of another HTTP service. RFC semantics take precedence over historical endpoint behavior. This document records the normative basis and the deliberate limits of the Cloudflare Workers Fetch runtime.

## Standards

| Feature | Reference | Behavior |
| --- | --- | --- |
| Methods, status, headers, redirects, content types | RFC 9110 | GET/HEAD metadata, OPTIONS Allow, contentless statuses, and explicit redirect Location behavior |
| Preconditions | RFC 9110, Section 13 | If-Match and If-None-Match entity-tag comparison, HTTP date validators, and evaluation precedence |
| Byte ranges | RFC 9110, Section 14 | Single byte ranges, suffixes, 206, 416, Content-Range, and If-Range |
| Caching | RFC 9111 | Cacheable fixtures have stable representations; request inspection is non-cacheable |
| Basic authentication | RFC 7617 | Case-insensitive Basic scheme and UTF-8 credential decoding |
| Digest authentication | RFC 7616 | SHA-256 by default, MD5 when explicitly selected, expiring nonce and nonce-count checks |
| Bearer syntax | RFC 6750 | Demonstrates the Authorization scheme, not token verification |
| Content negotiation | RFC 9110, Section 12 | Accept/Accept-Encoding quality weights, Vary, and 406 when requested representations are unavailable |
| Cookies | RFC 6265 | Cookie-name validation and Secure attributes when HTTPS is used |
| API descriptions | OpenAPI 3.1 | Explicit method/response descriptions and HTTP authentication schemes |

## Resource behavior

- `/get`, `/post`, `/put`, `/patch`, `/delete`, and `/anything` inspect requests without persisting them. Payloads and headers may contain secrets; avoid sending real credentials.
- `HEAD` produces the corresponding GET representation metadata without a response body. `OPTIONS` returns a resource-specific `Allow` header for known API paths.
- `/status/{codes}` selects a status without fabricating a Location header. 1xx statuses cannot be represented through the Workers Response API; requests for them return 501. Responses with 204, 205, or 304 do not contain content.
- `/response-headers` sets safe response fields. It refuses user-supplied framing and content-coding headers, because Fetch and the edge control those details.
- Redirect fixtures return 3xx Location fields but never fetch external destinations.
- Cookie examples validate names, encode values, and apply `Secure` over HTTPS. They are not a session-management service.
- `/image` negotiates by `Accept` and emits `Vary: Accept`; explicit format paths return their selected format. Compression fixtures use `Accept-Encoding` and `Vary: Accept-Encoding`.
- `/cache` and `/cache/{n}` emit fixed representations independent of Authorization or other request headers. `/etag/{etag}` is a fixed conditional-response fixture. In contrast, inspector and random-response endpoints use `Cache-Control: no-store`.
- `/range/{n}` supports one byte range. Multiple ranges are deliberately ignored and produce a complete 200 response; multipart/byteranges is not implemented.
- `/stream/{n}` emits `application/x-ndjson`. `/stream-bytes/{n}` and `/drip` demonstrate incremental delivery. Transfer coding, stream chunk boundaries observed by clients, and connection framing are controlled by the runtime.
- Generated data is limited to 1 MiB, streams to 100 records, redirect chains to 20, and delays to 10 seconds. Oversized size parameters are rejected instead of silently truncated.

## Authentication boundary

Authentication endpoints demonstrate challenge/response syntax. Usernames and passwords are provided as URL parameters, which is unsuitable for real credentials. Digest nonces expire after five minutes and nonce-count replays are rejected within an individual Worker isolate. Cross-isolate nonce validation and durable replay prevention are **not** provided, so Digest endpoints are not suitable for access control. Do not store credentials in this service.

## Platform limits

The Workers Fetch runtime does not offer arbitrary low-level control of HTTP/1.1 framing, 1xx responses, browser redirect details, or all content codings. Brotli may return 501 if no encoder is available. The browser playground cannot programmatically set forbidden request headers or negotiate Digest; use a suitable command-line client for these tests.

Tests verify the implemented contract rather than asserting compatibility with another HTTPBin implementation. Production routing and custom domains must be configured separately; `workers_dev` and preview URLs are disabled.
