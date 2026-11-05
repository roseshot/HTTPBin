# HTTPBin Workers

[![CI](https://github.com/roseshot/HTTPBin/actions/workflows/ci.yml/badge.svg)](https://github.com/roseshot/HTTPBin/actions/workflows/ci.yml)

An RFC-oriented HTTP testing and inspection service built on Cloudflare Workers, with an interactive playground and OpenAPI documentation.

## Features

- Inspect HTTP methods, headers, query parameters, request bodies, and file uploads.
- Test authentication, redirects, cookies, status codes, and streaming responses.
- Explore caching, conditional requests, byte ranges, compression, and content negotiation.
- Build and replay requests in the browser, or use any HTTP client.

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
bun run typecheck
bun test
bun run build
```

## Deployment

Authenticate with Cloudflare, configure a custom domain or route, then run:

```sh
bun run deploy
```

The default `workers.dev` and preview URLs are disabled in `wrangler.jsonc`.

## Documentation

- `/docs` — API explorer and playground
- `/openapi.json` — OpenAPI 3.1 specification
- [HTTP semantics and runtime limitations](docs/http-semantics.md)

The service is intended for testing. Do not send real credentials or sensitive data to public instances.

## Contributing

Issues and pull requests are welcome. Please run the checks in [Development](#development) before submitting changes.

## License

[GNU AGPL-3.0](LICENSE).
