export type Pair = { id: number; key: string; value: string };
export type RequestTab = "params" | "headers" | "body" | "auth";
export type ResponseTab = "body" | "headers" | "timeline";
export type BodyMode = "json" | "text" | "form" | "multipart" | "binary" | "none";
export type Timeline = { time: number; label: string };
export type Result = {
  status: number;
  statusText: string;
  elapsed: number;
  headers: [string, string][];
  text: string;
  bytes: number;
  contentType: string;
  imageUrl?: string;
  finalUrl: string;
  redirected: boolean;
  chunks: number;
  timeline: Timeline[];
  warning?: string;
  unexpectedHtml?: boolean;
};
let nextPairId = 0;
export function pair(key = "", value = ""): Pair { return { id: ++nextPairId, key, value }; }
export type AuthType = "none" | "basic" | "bearer";
