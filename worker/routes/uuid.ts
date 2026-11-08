import type { Hono } from "hono";
import { error, json } from "../lib/http";
import { generateUuid, parseUuidVersion } from "../lib/uuid";

export function registerUuidRoutes(app: Hono): void {
  async function uuidResponse(versionValue: string | undefined, namespace: string | undefined, name: string | undefined): Promise<Response> {
    const version = parseUuidVersion(versionValue);
    if (version === null) return error("Supported UUID versions: 1, 3, 4, 5, 6, 7, 8.");
    if ((version === 3 || version === 5) && (namespace === undefined || name === undefined)) {
      return error("UUID versions 3 and 5 require namespace and name query parameters.");
    }
    if (version === 8 && (namespace === undefined) !== (name === undefined)) {
      return error("UUID version 8 requires both namespace and name for deterministic output.");
    }
    try { return json({ uuid: await generateUuid(version, namespace, name) }); }
    catch (cause) { return error(cause instanceof Error ? cause.message : "Invalid UUID parameters."); }
  }
  app.get("/uuid", (c) => uuidResponse(c.req.query("version"), c.req.query("namespace"), c.req.query("name")));
  app.get("/uuid/:version", (c) => uuidResponse(c.req.param("version"), c.req.query("namespace"), c.req.query("name")));
}
