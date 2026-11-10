import type { Endpoint, Method } from "../../../shared/endpoints";
import type { AuthType, BodyMode } from "./types";

type SampleField = { key: string; value: string };

export interface EndpointRequestDefaults {
  path: string;
  method: Method;
  params: SampleField[];
  headers: SampleField[];
  bodyMode: BodyMode;
  body: string;
  authType: AuthType;
  username: string;
  password: string;
  token: string;
}

const DEFAULT_JSON_BODY = '{\n  "hello": "world"\n}';
const DIGEST_BODY = "hello";
const DIGEST_HEADER = "sha-256=:LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=:";

export function endpointRequestDefaults(endpoint: Endpoint): EndpointRequestDefaults {
  const samplePath = endpoint.example ?? endpoint.path.replace(
    /\{([^}]+)\}/g,
    (_match, name: string) => endpoint.parameters?.find((parameter) => parameter.in === "path" && parameter.name === name)?.example ?? "1",
  );
  const sampleUrl = new URL(samplePath, "https://example.invalid");
  const params = Array.from(sampleUrl.searchParams, ([key, value]) => ({ key, value }));
  const headers: SampleField[] = [];

  for (const parameter of endpoint.parameters ?? []) {
    if (parameter.example === undefined) continue;
    const field = { key: parameter.name, value: parameter.example };
    if (parameter.in === "query" && !params.some((item) => item.key === field.key)) params.push(field);
    if (parameter.in === "header" && !headers.some((item) => item.key.toLowerCase() === field.key.toLowerCase())) headers.push(field);
  }

  let bodyMode: BodyMode = "json";
  let body = DEFAULT_JSON_BODY;
  if (endpoint.path === "/digest/verify") {
    bodyMode = "text";
    body = DIGEST_BODY;
    headers.push({ key: "Content-Digest", value: DIGEST_HEADER });
  } else if (endpoint.path === "/prefer") {
    bodyMode = "none";
    headers.push({ key: "Prefer", value: "return=minimal" });
  }

  const basic = endpoint.path.startsWith("/basic-auth/") || endpoint.path.startsWith("/hidden-basic-auth/");
  const bearer = endpoint.path === "/bearer";
  const pathValue = (key: string) => endpoint.parameters?.find((parameter) => parameter.in === "path" && parameter.name === key)?.example ?? "";

  return {
    path: sampleUrl.pathname,
    method: endpoint.method === "ANY" ? "GET" : endpoint.method,
    params,
    headers,
    bodyMode,
    body,
    authType: basic ? "basic" : bearer ? "bearer" : "none",
    username: basic ? pathValue("user") : "",
    password: basic ? pathValue("passwd") : "",
    token: bearer ? "demo-token" : "",
  };
}
