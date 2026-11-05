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

The playground supports query parameters, request headers, JSON and text bodies, URL-encoded and multipart forms, Basic, Digest, and Bearer authentication, cURL export, streaming responses, header inspection, and response timing. Requests are restricted to the same origin in the browser.

## HTTP endpoints

HTTPBin-compatible routes cover request inspection, HTTP methods, authentication, status codes, response headers, redirects, cookies, dynamic bytes, Base64 decoding, streaming, caching, representations, and image samples. For the complete list, see the interactive API explorer or `/openapi.json`.

For example:

```sh
curl 'http://localhost:5173/get?name=example'
curl -X POST 'http://localhost:5173/post' -H 'Content-Type: application/json' -d '{"hello":"world"}'
curl -i 'http://localhost:5173/status/418'
curl --digest -u demo:secret 'http://localhost:5173/digest-auth/auth/demo/secret'
curl -N 'http://localhost:5173/stream/5'
```

## Runtime compatibility and limits

This service follows HTTPBin's route conventions, but Cloudflare Workers and browser Fetch APIs do not expose every wire-level behavior of a traditional HTTP server. Transfer encoding, certain response headers, informational responses, redirect visibility, and compression negotiation may differ from the original service. Brotli output returns HTTP 501 when the runtime does not provide a Brotli encoder.

The application caps request bodies and generated binary responses at 1 MiB, stream records at 100, redirect chains at 20 hops, and time-based delays at 10 seconds. The image endpoints return small sample images. Request payloads are not persisted.

The application does not expose an outbound HTTP proxy. The `/redirect-to` endpoint emits a Location header without fetching the destination.

## Project layout

- `shared/endpoints.ts` — shared endpoint registry
- `worker/` — Hono handlers, HTTP utilities, and OpenAPI generation
- `src/` — React explorer and Base UI components
- `wrangler.jsonc` — Cloudflare Workers configuration

## License

See [LICENSE](LICENSE).
