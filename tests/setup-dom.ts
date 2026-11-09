import { Window } from "happy-dom";

const browser = new Window({ url: "http://localhost:3000/" });
const globals = [
  "document", "navigator", "location", "history", "localStorage",
  "Node", "Element", "HTMLElement", "Document", "Event",
  "MouseEvent", "KeyboardEvent", "PointerEvent", "MutationObserver",
  "CustomEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame",
] as const;

Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
for (const name of globals) {
  const value: unknown = Reflect.get(browser, name);
  if (value !== undefined) Object.defineProperty(globalThis, name, { configurable: true, value });
}
