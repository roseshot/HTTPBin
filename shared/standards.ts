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
    implemented: "Methods and status codes, HEAD and OPTIONS, redirects, conditional requests, single byte ranges, and selected content negotiation.",
    missing: "Multiple byte ranges, informational 1xx responses, and general-purpose representation negotiation are not implemented.",
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
