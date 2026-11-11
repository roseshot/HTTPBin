import { describe, expect, test } from "bun:test";
import { jsonCellText, JSON_TABLE_MAX_COLUMNS, JSON_TABLE_MAX_ROWS, parseJsonTable } from "./json-table";

describe("JSON response table", () => {
  test("shows objects as key-value rows with readable nested values", () => {
    const table = parseJsonTable('{"ok":true,"data":{"name":"Alice"},"items":[1,2],"nothing":null}');
    expect(table?.kind).toBe("object");
    expect(table?.rows).toEqual([
      ["ok", true], ["data", { name: "Alice" }], ["items", [1, 2]], ["nothing", null],
    ]);
    expect(jsonCellText(table?.rows[1]?.[1])).toContain('"name": "Alice"');
    expect(jsonCellText(null)).toBe("null");
    expect(jsonCellText(undefined)).toBe("—");
  });

  test("renders arrays of objects as tables with their union of keys", () => {
    const table = parseJsonTable('[{"id":1,"name":"A"},{"id":2,"active":false}]');
    expect(table?.kind).toBe("records");
    expect(table?.columns).toEqual(["id", "name", "active"]);
    expect(table?.rows).toEqual([[1, "A", undefined], [2, undefined, false]]);
  });

  test("renders mixed, primitive, and empty arrays using index and value columns", () => {
    const mixed = parseJsonTable('[1,{"a":2},"text",null]');
    expect(mixed?.kind).toBe("array");
    expect(mixed?.rows).toEqual([[0, 1], [1, { a: 2 }], [2, "text"], [3, null]]);
    expect(parseJsonTable("[]")?.rows).toEqual([]);
    expect(parseJsonTable("[{},{}]")?.kind).toBe("array");
    expect(parseJsonTable("false")?.rows).toEqual([[false]]);
  });

  test("falls back to raw text for incomplete or invalid JSON", () => {
    expect(parseJsonTable('{"unfinished":')).toBeNull();
    expect(parseJsonTable("")).toBeNull();
    expect(parseJsonTable("<!doctype html>")).toBeNull();
  });

  test("caps large tables and flags truncated results", () => {
    const manyRows = Array.from({ length: JSON_TABLE_MAX_ROWS + 4 }, (_, id) => ({ id }));
    const rows = parseJsonTable(JSON.stringify(manyRows));
    expect(rows?.rows).toHaveLength(JSON_TABLE_MAX_ROWS);
    expect(rows?.truncated).toBe(true);
    const manyColumns = Object.fromEntries(
      Array.from({ length: JSON_TABLE_MAX_COLUMNS + 5 }, (_, i) => ["field" + i, i]),
    );
    const columns = parseJsonTable(JSON.stringify([manyColumns]));
    expect(columns?.columns).toHaveLength(JSON_TABLE_MAX_COLUMNS);
    expect(columns?.truncated).toBe(true);
  });
});
