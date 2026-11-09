# HTTPBin Workers

[![CI](https://github.com/roseshot/HTTPBin/actions/workflows/ci.yml/badge.svg)](https://github.com/roseshot/HTTPBin/actions/workflows/ci.yml)

An RFC-oriented HTTP testing and inspection service built on Cloudflare Workers, with an interactive playground and OpenAPI documentation.

## Features

- Inspect HTTP methods, headers, query parameters, request bodies, and file uploads.
- Test authentication, redirects, cookies, status codes, and streaming responses.
- Explore caching, conditional requests, byte ranges, compression, and content negotiation.
- Test HTTP QUERY, Problem Details, Content-Digest, and modern response fields.
- Build and replay requests in the browser, or use any HTTP client.
- Browse the web interface in 18 languages, including right-to-left Arabic; API responses remain unchanged.

Designed around modern HTTP semantics rather than compatibility with the original HTTPBin.

## Quick start

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev
```

Open the local URL printed by Vite to use the API explorer and playground.

```sh
curl -i 'http://localhost:5173/get?hello=world'
curl -i -X POST 'http://localhost:5173/post' -H 'Content-Type: application/json' -d '{"hello":"world"}'
```

## Development

```sh
bun run lint
bun run typecheck
bun test
bun run build
```

## Project layout

- `src/` contains the React interface; Playground request editing, execution, copying, and response rendering live in `src/features/playground/`.
- `src/styles/` separates theme, layout, Playground, standards, responsive, and localization styles.
- `worker/index.ts` registers Hono routes from `worker/routes/`; reusable HTTP logic lives in `worker/lib/`, and deterministic image data lives in `worker/fixtures/`.
- `shared/` contains endpoint metadata and RFC coverage shared by the API and interface.
- Tests live beside the corresponding modules or in `worker/` for API-level integration coverage.

Dependencies are pinned in `bun.lock`. CI uses `bun install --frozen-lockfile`, Oxlint, TypeScript 7.1 strict checks, Bun tests (including Happy DOM component interactions), and Vite builds.

## Deployment

Authenticate with Cloudflare, configure a custom domain or route, then run:

```sh
bun run deploy
```

The default `workers.dev` and preview URLs are disabled in `wrangler.jsonc`.

## Documentation

- `/docs` — API explorer and playground
- `/standards` — RFC coverage and limitations
- `/openapi.json` — OpenAPI 3.2.1 specification
- [HTTP semantics and runtime limitations](docs/http-semantics.md)

The service is intended for testing. Do not send real credentials or sensitive data to public instances.

## Contributing

Issues and pull requests are welcome. Please run the checks in [Development](#development) before submitting changes.

## License

[GNU AGPL-3.0](LICENSE).
