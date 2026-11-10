// Interface translations only. API metadata, OpenAPI, repository files, and response payloads stay in English.
export const english = {
  "apiExplorer": "API Explorer",
  "standards": "Standards",
  "themeDark": "Switch to dark mode",
  "themeLight": "Switch to light mode",
  "language": "Language",
  "endpoints": "API endpoints",
  "search": "Search endpoints...",
  "noMatch": "No matching endpoints.",
  "reference": "HTTP API Reference",
  "parameters": "Parameters",
  "parametersHelp": "Configure these values in the request URL or the playground.",
  "requestBody": "Request body",
  "requestBodyHelp": "Supported payloads depend on the HTTP method.",
  "responses": "Responses",
  "success": "Success",
  "successHelp": "Response body and headers vary by endpoint and test parameters.",
  "errorsHelp": "Expected HTTP error codes are returned as responses, not application failures.",
  "runtime": "Cloudflare Workers compatibility",
  "runtimeHelp": "Some wire-level headers, compression behavior, and redirect details are controlled by the Workers runtime or browser. Use cURL for raw HTTP tests.",
  "rfcLink": "View RFC coverage and limitations",
  "footDocs": "Stateless by design · Runs on Cloudflare Workers · OpenAPI 3.2.1",
  "playground": "HTTP Playground",
  "live": "LIVE",
  "request": "Request",
  "response": "Response",
  "sameOrigin": "Same-origin requests only",
  "params": "Params",
  "headers": "Headers",
  "body": "Body",
  "auth": "Auth",
  "contentType": "Content type",
  "json": "JSON",
  "plainText": "Plain text",
  "form": "Form URL encoded",
  "multipart": "Multipart form",
  "binary": "Binary (UTF-8 bytes)",
  "noBody": "No body",
  "payload": "Request payload",
  "noBodyMessage": "No request body will be sent.",
  "bodyGuard": "GET, HEAD, and OPTIONS requests cannot contain a body in the browser.",
  "authScheme": "Authorization scheme",
  "noAuth": "No authentication",
  "basicAuth": "Basic authentication",
  "bearerToken": "Bearer token",
  "username": "Username",
  "password": "Password",
  "token": "Token",
  "credentialsHint": "Credentials stay in this browser session and are not stored by the playground.",
  "followRedirects": "Automatically follow redirects",
  "copyCurl": "Copy cURL",
  "copyExchange": "Copy Req + Res",
  "copied": "Copied",
  "send": "Send Request",
  "sending": "Sending...",
  "cancel": "Cancel request",
  "format": "Format",
  "emptyBody": "(empty response body)",
  "binaryReceived": "Binary response received. Use cURL to inspect the raw bytes.",
  "unexpectedHtmlTitle": "Unexpected HTML response",
  "unexpectedHtmlHelp": "The server returned an HTML page instead of the expected API response. Check the request path and routing. The HTML source is hidden.",
  "imagePreview": "Response preview",
  "finalUrl": "Final URL",
  "timeline": "Timeline",
  "noHeaders": "No response headers are exposed.",
  "responsePlaceholder": "Your response will appear here",
  "responsePlaceholderHelp": "Configure a request and select Send Request.",
  "footPlayground": "Requests run directly in your browser against this Worker.",
  "required": "required",
  "example": "Example",
  "noParams": "No declared parameters. You can still append custom query parameters or headers.",
  "noRequestBody": "No request body is required for this endpoint.",
  "exampleBody": "Example request body",
  "add": "Add",
  "remove": "Remove",
  "key": "Key",
  "value": "Value",
  "itemName": "name",
  "itemValue": "value",
  "addHint": "Add entries to your request.",
  "errorPath": "Use a same-origin path beginning with /.",
  "errorCrossOrigin": "Cross-origin requests are not supported.",
  "errorRequest": "Invalid request.",
  "errorFailed": "Request failed.",
  "errorCopy": "Unable to copy request.",
  "headersReceived": "Response headers received",
  "chunk": "Chunk",
  "bytes": "bytes",
  "opaqueWarning": "Browser Fetch hides the status and Location of manually handled redirects.",
  "redirectWarning": "The browser automatically followed redirects. Intermediate responses are not visible.",
  "rfcEyebrow": "Protocol reference",
  "rfcTitle": "RFC coverage & limitations",
  "rfcLede": "HTTPBin Workers implements selected HTTP behaviors described by IETF RFCs.",
  "rfcDisclaimer": "This is a feature-level summary, not a claim of full RFC compliance or certification.",
  "rfcHeading": "Standard-by-standard coverage",
  "rfcHeadingHelp": "What the service demonstrates, and where support stops.",
  "implementationNotes": "Implementation notes",
  "covered": "Covered behavior",
  "missing": "Not covered / limited",
  "unsupported": "Known unsupported capabilities",
  "unsupportedHelp": "Some features are intentionally out of scope; others are controlled by Cloudflare Workers or the browser.",
  "rfcNotice": "Coverage reflects documented behavior and automated tests, not an independent conformance audit. Cloudflare controls transport details. Authentication examples must not protect real resources.",
  "explore": "Explore HTTP endpoints",
  "subset": "Implemented subset",
  "demonstration": "Demonstration only",
  "runtimeControlled": "Runtime controlled",
  "rfcRead": "Read RFC on RFC Editor",
  "standardTitle": "Standard",
  "limit1": "1xx informational responses and raw HTTP message framing",
  "limit2": "Multipart byte-range responses (multipart/byteranges)",
  "limit3": "Persistent authentication, token verification, and cross-isolate Digest replay protection",
  "limit4": "HTTP/2 frame controls and HTTP/3 QUIC transport controls",
  "limit5": "Browser-forbidden request headers and direct inspection of intermediate redirects",
  "groupMethods": "HTTP Methods",
  "groupInspection": "Request Inspection",
  "groupAuthentication": "Authentication",
  "groupStatus": "Status Codes",
  "groupRedirects": "Redirects",
  "groupCookies": "Cookies",
  "groupFormats": "Response Formats",
  "groupData": "Dynamic Data",
  "groupStreaming": "Streaming",
  "groupCaching": "Caching",
  "groupImages": "Images",
  "groupUtilities": "Utilities",
  "descriptionMethods": "Inspect request methods, headers, and payloads.",
  "descriptionInspection": "Inspect client data and request headers.",
  "descriptionAuthentication": "Explore authentication challenges and credentials using test values.",
  "descriptionStatus": "Test HTTP status codes and response headers.",
  "descriptionRedirects": "Test different HTTP redirect responses.",
  "descriptionCookies": "Inspect, set, and remove test cookies.",
  "descriptionFormats": "Inspect HTTP representations, encodings, and media types.",
  "descriptionData": "Generate and decode sample HTTP payloads.",
  "descriptionStreaming": "Test streaming, delays, and partial content.",
  "descriptionCaching": "Explore cache directives and conditional requests.",
  "descriptionImages": "Explore different image media types.",
  "descriptionUtilities": "View sample HTML documents and utility endpoints."
} as const;
export type MessageKey = keyof typeof english;
export type TranslationMap = Partial<Record<MessageKey, string>>;

export const locales = [
  {
    "code": "en",
    "name": "English"
  },
  {
    "code": "zh-CN",
    "name": "简体中文"
  },
  {
    "code": "zh-TW",
    "name": "繁體中文"
  },
  {
    "code": "es",
    "name": "Español"
  },
  {
    "code": "fr",
    "name": "Français"
  },
  {
    "code": "de",
    "name": "Deutsch"
  },
  {
    "code": "pt-BR",
    "name": "Português (Brasil)"
  },
  {
    "code": "ja",
    "name": "日本語"
  },
  {
    "code": "ko",
    "name": "한국어"
  },
  {
    "code": "ru",
    "name": "Русский"
  },
  {
    "code": "ar",
    "name": "العربية"
  },
  {
    "code": "hi",
    "name": "हिन्दी"
  },
  {
    "code": "it",
    "name": "Italiano"
  },
  {
    "code": "nl",
    "name": "Nederlands"
  },
  {
    "code": "tr",
    "name": "Türkçe"
  },
  {
    "code": "id",
    "name": "Bahasa Indonesia"
  },
  {
    "code": "vi",
    "name": "Tiếng Việt"
  },
  {
    "code": "th",
    "name": "ไทย"
  }
] as const;
export type Locale = typeof locales[number]["code"];
export const DEFAULT_LOCALE: Locale = "en";
export const RTL_LOCALES: readonly Locale[] = ["ar"];

export function matchLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const normalized = value.replace(/_/g, "-").toLowerCase();
  const exact = locales.find(({ code }) => code.toLowerCase() === normalized);
  if (exact) return exact.code;
  if (normalized === "zh" || normalized.startsWith("zh-hans") || normalized.startsWith("zh-sg")) return "zh-CN";
  if (normalized.startsWith("zh-hant") || normalized.startsWith("zh-hk") || normalized.startsWith("zh-mo")) return "zh-TW";
  if (normalized.startsWith("zh-")) return "zh-CN";
  return locales.find(({ code }) => code.split("-")[0].toLowerCase() === (normalized.split("-")[0] ?? ""))?.code ?? null;
}

export function resolveLocale(query: string | null, stored: string | null, browser: readonly string[]): Locale {
  return matchLocale(query) ?? matchLocale(stored) ?? browser.map(matchLocale).find((locale): locale is Locale => locale !== null) ?? DEFAULT_LOCALE;
}

export function translate(key: MessageKey, messages: TranslationMap): string {
  const value = messages[key];
  return typeof value === "string" && value.trim() ? value : english[key];
}
