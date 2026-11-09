import { endpoints, type Endpoint } from "../../shared/endpoints";

const binary = { schema: { type: "string", format: "binary" } };
const successContent = {
  "application/json": { schema: { type: "object", additionalProperties: true } },
  "text/plain": { schema: { type: "string" } },
  "application/octet-stream": binary,
};

function security(endpoint: Endpoint) {
  if (endpoint.path.startsWith("/basic-auth/")) return [{ basicAuth: [] }];
  if (endpoint.path.startsWith("/digest-auth/")) return [{ digestAuth: [] }];
  if (endpoint.path === "/bearer") return [{ bearerAuth: [] }];
  return undefined;
}

function operation(endpoint: Endpoint, method: string): Record<string, unknown> {
  const parameters = (endpoint.parameters ?? []).map((param) => ({
    name: param.name,
    in: param.in,
    description: param.description,
    required: param.required ?? false,
    schema: { type: "string", ...(param.example ? { example: param.example } : {}) },
  }));
  const sendsBody = ["post", "put", "patch", "delete", "query"].includes(method) &&
    (endpoint.method === "ANY" || endpoint.method === method.toUpperCase());
  const media = endpoint.path === "/image" ? {
    "image/png": binary, "image/jpeg": binary, "image/webp": binary, "image/svg+xml": { schema: { type: "string" } },
    "image/gif": binary, "image/avif": binary, "image/bmp": binary, "image/x-icon": binary,
  } : successContent;
  return {
    tags: [endpoint.group],
    summary: endpoint.summary,
    description: endpoint.description,
    operationId: (method + "_" + endpoint.path).replace(/[^a-zA-Z0-9]+/g, "_"),
    ...(parameters.length ? { parameters } : {}),
    ...(sendsBody ? {
      requestBody: {
        required: false,
        content: {
          "application/json": { schema: {} },
          "text/plain": { schema: { type: "string" } },
          "application/octet-stream": binary,
          "application/x-www-form-urlencoded": { schema: { type: "object", additionalProperties: { type: "string" } } },
          "multipart/form-data": { schema: { type: "object", additionalProperties: true } },
        },
      },
    } : {}),
    ...(security(endpoint) ? { security: security(endpoint) } : {}),
    responses: {
      "200": { description: "Successful response", ...(method === "head" || method === "options" ? {} : { content: media }) },
      "204": { description: "No content" },
      "206": { description: "Partial content", content: { "multipart/byteranges": binary, "application/octet-stream": binary } },
      "302": { description: "Redirect" },
      "304": { description: "Not modified" },
      "400": { description: "Invalid request" },
      "401": { description: "Authentication required" },
      "405": { description: "Method not allowed", headers: { Allow: { schema: { type: "string" } } } },
      "406": { description: "Not acceptable" },
      "412": { description: "Precondition failed" },
      "413": { description: "Payload too large" },
      "415": { description: "Unsupported media type" },
      "422": { description: "Unprocessable content" },
      "416": { description: "Range not satisfiable" },
      default: { description: "Response status selected by the request or runtime" },
    },
  };
}

function supportedMethods(endpoint: Endpoint): string[] {
  if (endpoint.method === "ANY") return ["get", "head", "post", "put", "patch", "delete", "query", "options"];
  if (endpoint.method === "GET") return ["get", "head", "options"];
  return [endpoint.method.toLowerCase(), "options"];
}

export function openApi(origin: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of endpoints) {
    paths[endpoint.path] ??= {};
    const pathOperations = paths[endpoint.path];
    if (!pathOperations) throw new Error("Failed to initialize OpenAPI path.");
    for (const method of supportedMethods(endpoint)) pathOperations[method] = operation(endpoint, method);
  }
  const responseHeaderPath = paths["/response-headers"];
  const responseHeaderEndpoint = endpoints.find((item) => item.path === "/response-headers");
  if (responseHeaderPath && responseHeaderEndpoint) responseHeaderPath.post = operation(responseHeaderEndpoint, "post");
  const query = paths["/query"]?.query as Record<string, unknown> | undefined;
  if (query) {
    query.requestBody = { required: true, content: { "application/json": { schema: {} } } };
    query.responses = {
      ...(query.responses as Record<string, unknown>),
      "200": { description: "Processed safe, idempotent query", content: { "application/json": { schema: { type: "object" } } }, headers: { "Accept-Query": { schema: { type: "string" } } } },
    };
  }
  const digest = paths["/digest/generate/{algorithm}"]?.get as Record<string, unknown> | undefined;
  if (digest) (digest.responses as Record<string, unknown>)["200"] = {
    description: "Digest-bearing content", content: { "text/plain": { schema: { type: "string" } } },
    headers: { "Content-Digest": { schema: { type: "string" } }, "Repr-Digest": { schema: { type: "string" } } },
  };

  return {
    openapi: "3.2.1",
    info: {
      title: "HTTPBin Workers",
      version: "0.1.0",
      description: "RFC-oriented HTTP fixtures including RFC 10008 QUERY, RFC 9457 Problem Details and RFC 9530 Digest Fields. Transport framing is controlled by Cloudflare Workers.",
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: {
        basicAuth: { type: "http", scheme: "basic" },
        bearerAuth: { type: "http", scheme: "bearer" },
        digestAuth: { type: "http", scheme: "digest" },
      },
    },
    tags: [...new Set(endpoints.map((entry) => entry.group))].map((name) => ({ name })),
    paths,
  };
}

export function swagger(origin: string) {
  const spec = openApi(origin);
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [path, methods] of Object.entries(spec.paths)) {
    paths[path] = {};
    for (const [method, details] of Object.entries(methods)) {
      if (method === "query") continue; // Swagger 2.0 does not define a QUERY operation.
      const entry = details as {
        tags?: string[];
        summary?: string;
        description?: string;
        operationId?: string;
        parameters?: { name: string; in: string; description?: string; required?: boolean }[];
        responses: Record<string, { description: string }>;
      };
      paths[path][method] = {
        tags: entry.tags,
        summary: entry.summary,
        description: entry.description,
        operationId: entry.operationId,
        ...(entry.parameters ? { parameters: entry.parameters.map((param) => ({
          name: param.name, in: param.in, description: param.description, required: param.required,
          type: "string",
        })) } : {}),
        produces: ["application/json", "text/plain", "application/octet-stream"],
        responses: Object.fromEntries(Object.entries(entry.responses as Record<string, { description: string }>).map(
          ([status, response]) => [status, { description: response.description }]
        )),
      };
    }
  }
  const url = new URL(origin);
  return {
    swagger: "2.0",
    info: spec.info,
    host: url.host,
    schemes: [url.protocol.replace(":", "")],
    basePath: "/",
    tags: spec.tags,
    paths,
  };
}
