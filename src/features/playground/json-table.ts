export const JSON_TABLE_MAX_ROWS = 100;
export const JSON_TABLE_MAX_COLUMNS = 24;

export type JsonTableData = {
  kind: "object" | "records" | "array" | "scalar";
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Turn valid JSON into bounded rows and columns for the response table.
 * The raw response is kept separately and is never modified.
 */
export function parseJsonTable(text: string): JsonTableData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (Array.isArray(parsed)) {
    const items: unknown[] = parsed;
    const visible = items.slice(0, JSON_TABLE_MAX_ROWS);
    if (items.length > 0 && items.every(isRecord)) {
      const records: Record<string, unknown>[] = items;
      const visibleRecords = records.slice(0, JSON_TABLE_MAX_ROWS);
      const keys = Array.from(new Set(visibleRecords.flatMap((record) => Object.keys(record))));
      if (keys.length > 0) {
        const columns = keys.slice(0, JSON_TABLE_MAX_COLUMNS);
        return {
          kind: "records",
          columns,
          rows: visibleRecords.map((record) => columns.map((key) => record[key])),
          truncated: items.length > JSON_TABLE_MAX_ROWS || keys.length > JSON_TABLE_MAX_COLUMNS,
        };
      }
    }
    return {
      kind: "array",
      columns: [],
      rows: visible.map((value, index) => [index, value]),
      truncated: items.length > JSON_TABLE_MAX_ROWS,
    };
  }

  if (isRecord(parsed)) {
    const entries = Object.entries(parsed);
    return {
      kind: "object",
      columns: [],
      rows: entries.slice(0, JSON_TABLE_MAX_ROWS).map(([key, value]) => [key, value]),
      truncated: entries.length > JSON_TABLE_MAX_ROWS,
    };
  }

  return { kind: "scalar", columns: [], rows: [[parsed]], truncated: false };
}

/** Keep nested values legible while making absent fields distinct from null. */
export function jsonCellText(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
