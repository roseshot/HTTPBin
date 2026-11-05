# HTTPBin Workers

A stateless HTTP request and response inspection service built for Cloudflare Workers, with a React API explorer and a browser-based HTTP playground.

## Stack

- TypeScript and Bun
- Hono on Cloudflare Workers
- React and Vite
- shadcn/ui with Base UI primitives
- Tailwind CSS v4
- OpenAPI 3.1

## Getting started

Requires Bun and a Cloudflare account for deployment.

```sh
bun install
bun run dev
```

Open the local URL shown by Vite. The explorer and HTTP endpoints are served from the same origin.

## Commands

```sh
bun run typecheck
bun test
bun run build
bun run preview
bun run deploy
```

Authentication to Cloudflare is required before deployment. The deployment uses the Worker name in `wrangler.jsonc`.

## API explorer

- `/` and `/docs`: interactive API explorer and HTTP playground
- `/playground`: HTTP playground
- `/openapi.json`: OpenAPI 3.1 specification
- `/spec.json`: Swagger 2.0 compatibility specification
- `/__meta/endpoints`: machine-readable endpoint catalog

The playground supports query parameters, request headers, JSON and text bodies, URL-encoded and multipart forms, Basic and Bearer authentication, cURL export, streaming responses, header inspection, and response timing. Requests are restricted to the same origin in the browser.

## HTTP endpoints

The behavior contract and RFC feature matrix are documented in [HTTP Semantics Contract](docs/http-semantics.md).

The API is designed around modern HTTP semantics and Cloudflare Workers Fetch/Streams APIs, not wire compatibility with another HTTPBin implementation. Routes cover request inspection, HTTP methods, authentication, status codes, response headers, redirects, cookies, dynamic bytes, streaming, conditional requests, range retrieval, and sample representations. For the full list, see the API explorer or `/openapi.json`.

For example:

```sh
curl 'http://localhost:5173/get?name=example'
curl -X POST 'http://localhost:5173/post' -H 'Content-Type: application/json' -d '{"hello":"world"}'
curl -i 'http://localhost:5173/status/418'
curl --digest -u demo:secret 'http://localhost:5173/digest-auth/auth/demo/secret/SHA-256'
curl -N 'http://localhost:5173/stream/5'
```

## Runtime compatibility and limits

This service follows modern HTTP semantics instead of attempting exact compatibility with legacy HTTPBin responses. Cloudflare Workers and browser Fetch APIs do not expose every wire-level behavior of a traditional HTTP server. Transfer encoding, certain response headers, informational responses, redirect visibility, and compression support depend on the Workers runtime. Brotli output returns HTTP 501 when the runtime does not provide a Brotli encoder.

The application rejects request bodies and generated binary sizes above 1 MiB, stream records above 100, and redirect chains above 20 hops; time-based delays are capped at 10 seconds. The image endpoints return small sample images. Request payloads are not persisted.

The application does not expose an outbound HTTP proxy. The `/redirect-to` endpoint emits a Location header without fetching the destination. Digest challenge-response requires an HTTP client such as `curl --digest`; the browser playground does not negotiate Digest authentication. Digest nonce and replay tracking are isolate-local demonstration behavior, not production access control. Conditional requests use strong If-Match comparison, weak If-None-Match comparison, and valid HTTP dates. Byte ranges support one range per request; multiple ranges are ignored.

## Project layout

- `shared/endpoints.ts` — shared endpoint registry
- `worker/` — Hono handlers, RFC semantics and negotiation, HTTP utilities, and OpenAPI generation
- `docs/http-semantics.md` — RFC behavior contract and runtime limitations
- `src/` — React explorer and Base UI components
- `wrangler.jsonc` — Cloudflare Workers configuration

## License

See [LICENSE](LICENSE).
