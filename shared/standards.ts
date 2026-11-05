export type CoverageLevel = "subset" | "demonstration" | "runtime";

export interface StandardCoverage {
  rfc: number;
  title: string;
  level: CoverageLevel;
  implemented: string;
  missing: string;
}

export const standards: StandardCoverage[] = [
  {
    rfc: 9110,
    title: "HTTP Semantics",
    level: "subset",
    implemented: "Methods and status codes, HEAD and OPTIONS, redirects, conditional requests, single and multipart byte ranges, and selected content negotiation.",
    missing: "Informational 1xx responses and general-purpose representation negotiation are not implemented; multipart ranges have strict resource caps.",
  },
  {
    rfc: 9111,
    title: "HTTP Caching",
    level: "subset",
    implemented: "Stable cache fixtures, Cache-Control, ETag and Last-Modified validators, and conditional 304 responses.",
    missing: "This service is not an HTTP cache and does not implement intermediary storage, freshness calculations, or shared-cache revalidation.",
  },
  {
    rfc: 7617,
    title: "HTTP Basic Authentication",
    level: "subset",
    implemented: "Basic challenges, case-insensitive scheme parsing, and UTF-8 credential decoding.",
    missing: "Credentials are test inputs in URLs, not a secure user-management or access-control system.",
  },
  {
    rfc: 7616,
    title: "HTTP Digest Authentication",
    level: "demonstration",
    implemented: "MD5 and SHA-256 challenge/response, expiring nonces, and per-isolate nonce-count replay checks.",
    missing: "Nonce and replay state are not shared across Worker isolates; this is not production-ready authentication.",
  },
  {
    rfc: 6750,
    title: "OAuth 2.0 Bearer Token Usage",
    level: "demonstration",
    implemented: "The Authorization: Bearer header format and a challenge example.",
    missing: "Tokens are not issued, verified, scoped, introspected, or authorized.",
  },
  {
    rfc: 6265,
    title: "HTTP State Management",
    level: "subset",
    implemented: "Set-Cookie examples, Cookie inspection and deletion, name validation, and Secure cookies on HTTPS.",
    missing: "No browser cookie jar, full user-agent processing, or session lifecycle is implemented.",
  },
  {
    rfc: 10008,
    title: "HTTP QUERY Method",
    level: "subset",
    implemented: "Safe, idempotent QUERY fixture with JSON content, Accept-Query discovery, and media-type validation.",
    missing: "No persistent query engine or QUERY cache. Browser and edge support should be validated in deployment.",
  },
  {
    rfc: 9457,
    title: "Problem Details for HTTP APIs",
    level: "subset",
    implemented: "Shared application error responses using application/problem+json and standardized problem members.",
    missing: "Platform-generated error pages and arbitrary HTTP status fixtures are not rewritten as problem details.",
  },
  {
    rfc: 9530,
    title: "HTTP Digest Fields",
    level: "subset",
    implemented: "SHA-256 and SHA-512 Content-Digest and Repr-Digest fixtures, plus request-content verification.",
    missing: "No trailer digests, digest negotiation with Want-Content-Digest, or signature-based authentication.",
  },
  {
    rfc: 9651,
    title: "Structured Field Values",
    level: "demonstration",
    implemented: "Structured Dictionary example and digest-specific Byte Sequence Dictionary parser.",
    missing: "A complete RFC 9651 Item/List/Dictionary parser and serializer is not implemented.",
  },
  {
    rfc: 7240,
    title: "Prefer",
    level: "demonstration",
    implemented: "return=minimal and Preference-Applied response behavior.",
    missing: "Other preference tokens, including respond-async, are not implemented.",
  },
  {
    rfc: 6266,
    title: "Content-Disposition",
    level: "subset",
    implemented: "Attachment Content-Disposition with ASCII fallback and RFC 8187 UTF-8 filename*.",
    missing: "No full Content-Disposition parser or user-agent download handling.",
  },
  {
    rfc: 8288,
    title: "Web Linking",
    level: "demonstration",
    implemented: "Typed Link relation fixtures for pagination and deprecation.",
    missing: "No generic Web Link relation parser or linked-resource graph.",
  },
  {
    rfc: 8594,
    title: "Sunset",
    level: "demonstration",
    implemented: "Sunset date and successor Link fixture.",
    missing: "The sample does not represent real lifecycle policy.",
  },
  {
    rfc: 9745,
    title: "Deprecation Response Field",
    level: "demonstration",
    implemented: "Structured Deprecation date with an example Sunset and successor link.",
    missing: "The sample is illustrative and is not the deprecation schedule of the service itself.",
  },
  {
    rfc: 9112,
    title: "HTTP/1.1 Message Syntax",
    level: "runtime",
    implemented: "The Worker exchanges HTTP requests and responses through the Fetch API.",
    missing: "Message framing, chunked transfer coding, and connection management are not exposed to application code.",
  },
  {
    rfc: 9113,
    title: "HTTP/2",
    level: "runtime",
    implemented: "The Cloudflare edge may negotiate HTTP/2 with clients.",
    missing: "Frame encoding, HPACK, stream prioritization, and connection-level controls are not available to this Worker.",
  },
  {
    rfc: 9114,
    title: "HTTP/3",
    level: "runtime",
    implemented: "The Cloudflare edge may negotiate HTTP/3 with clients.",
    missing: "QUIC streams, packet handling, and transport behavior cannot be controlled by the application.",
  },
];

export const coverageLabels: Record<CoverageLevel, string> = {
  subset: "Implemented subset",
  demonstration: "Demonstration only",
  runtime: "Runtime controlled",
};

export const unsupportedCapabilities = [
  "1xx informational responses and raw HTTP message framing",
  "Multipart byte-range responses (multipart/byteranges)",
  "Persistent authentication, token verification, and cross-isolate Digest replay protection",
  "HTTP/2 frame controls and HTTP/3 QUIC transport controls",
  "Browser-forbidden request headers and direct inspection of intermediate redirects",
] as const;

export function rfcUrl(rfc: number): string {
  return `https://www.rfc-editor.org/rfc/rfc${rfc}.html`;
}
