import { endpoints, type Endpoint } from "../shared/endpoints";

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
  const sendsBody = ["post", "put", "patch", "delete"].includes(method) &&
    (endpoint.method === "ANY" || endpoint.method === method.toUpperCase());
  const media = endpoint.path === "/image" ? {
    "image/png": binary, "image/jpeg": binary, "image/webp": binary, "image/svg+xml": { schema: { type: "string" } },
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
      "206": { description: "Partial content" },
      "302": { description: "Redirect" },
      "304": { description: "Not modified" },
      "400": { description: "Invalid request" },
      "401": { description: "Authentication required" },
      "406": { description: "Not acceptable" },
      "412": { description: "Precondition failed" },
      "413": { description: "Payload too large" },
      "416": { description: "Range not satisfiable" },
      default: { description: "Response status selected by the request or runtime" },
    },
  };
}

function supportedMethods(endpoint: Endpoint): string[] {
  if (endpoint.method === "ANY") return ["get", "head", "post", "put", "patch", "delete", "options"];
  if (endpoint.method === "GET") return ["get", "head", "options"];
  return [endpoint.method.toLowerCase(), "options"];
}

export function openApi(origin: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of endpoints) {
    paths[endpoint.path] ??= {};
    for (const method of supportedMethods(endpoint)) paths[endpoint.path][method] = operation(endpoint, method);
  }
  paths["/response-headers"].post = operation(endpoints.find((item) => item.path === "/response-headers")!, "post");
  return {
    openapi: "3.1.0",
    info: {
      title: "HTTPBin Workers",
      version: "0.1.0",
      description: "RFC 9110/9111 HTTP test fixtures on Cloudflare Workers. Transport-level behavior is determined by Fetch and the Workers runtime.",
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
      const entry = details as Record<string, any>;
      paths[path][method] = {
        tags: entry.tags,
        summary: entry.summary,
        description: entry.description,
        operationId: entry.operationId,
        ...(entry.parameters ? { parameters: entry.parameters.map((param: any) => ({
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
