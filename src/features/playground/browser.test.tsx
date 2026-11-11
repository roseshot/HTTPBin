import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { I18nProvider } from "../../i18n";
import { RequestActions } from "./RequestActions";
import { ResponseViewer } from "./ResponseViewer";
import { REQUEST_TOOL_STORAGE_KEY } from "./request-snippets";
import { captureRequest } from "./request-exchange";
import type { ResponseTab, Result } from "./types";

const makeRequest = () => ({
  url: new URL("https://example.com/get"),
  requestHeaders: new Headers(),
});

function actions(onSend = () => {}, onCancel = () => {}, loading = false) {
  return <I18nProvider>
    <RequestActions
      method="GET"
      sentRequest={null}
      result={null}
      makeRequest={makeRequest}
      followRedirect={true}
      setFollowRedirect={() => {}}
      loading={loading}
      onSend={onSend}
      onCancel={onCancel}
      errorMessage=""
      onError={() => {}}
    />
  </I18nProvider>;
}

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Playground browser interactions", () => {
  test("copies the chosen format and restores it after remounting", async () => {
    const copied: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value: string) => { copied.push(value); } },
    });

    render(actions());
    fireEvent.click(screen.getByRole("button", { name: /copy curl formats/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "PowerShell" }));

    await waitFor(() => expect(copied).toHaveLength(1));
    expect(copied[0]).toContain("Invoke-WebRequest");
    expect(localStorage.getItem(REQUEST_TOOL_STORAGE_KEY)).toBe("pwsh");

    cleanup();
    render(actions());
    fireEvent.click(screen.getByRole("button", { name: "Copy PowerShell" }));
    await waitFor(() => expect(copied).toHaveLength(2));
    expect(copied[1]).toContain("Invoke-WebRequest");
  });

  test("copies the sent request and response together without the host", async () => {
    const copied: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value: string) => { copied.push(value); } },
    });
    const response: Result = {
      status: 200, statusText: "OK", elapsed: 12,
      headers: [["content-type", "application/json"]],
      text: '{"url":"https://example.com/get","hello":"world"}',
      bytes: 55, contentType: "application/json", finalUrl: "https://example.com/get",
      redirected: false, chunks: 1, timeline: [],
    };
    const sentRequest = captureRequest(
      new URL("https://example.com/get?hello=world"),
      "GET",
      new Headers({ accept: "application/json" }),
    );

    render(<I18nProvider>
      <RequestActions
        method="GET" sentRequest={null} result={null} makeRequest={makeRequest}
        followRedirect={true} setFollowRedirect={() => {}} loading={false}
        onSend={() => {}} onCancel={() => {}} errorMessage="" onError={() => {}}
      />
    </I18nProvider>);
    expect(screen.getByRole("button", { name: "Copy Req + Res" }).hasAttribute("disabled")).toBe(true);
    cleanup();

    render(<I18nProvider>
      <RequestActions
        method="GET" sentRequest={sentRequest} result={response} makeRequest={makeRequest}
        followRedirect={true} setFollowRedirect={() => {}} loading={false}
        onSend={() => {}} onCancel={() => {}} errorMessage="" onError={() => {}}
      />
    </I18nProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Copy Req + Res" }));
    await waitFor(() => expect(copied).toHaveLength(1));
    expect(copied[0]).toContain("GET /get?hello=world");
    expect(copied[0]).toContain("200 OK");
    expect(copied[0]).not.toContain("example.com");
  });

  test("supports keyboard navigation, Escape, send and cancellation", () => {
    let sent = 0;
    let cancelled = 0;
    const send = () => { sent++; };
    const cancel = () => { cancelled++; };

    render(actions(send, cancel));
    fireEvent.click(screen.getByRole("button", { name: /copy curl formats/i }));
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "End" });
    expect((document.activeElement as HTMLElement).textContent).toBe("PowerShell");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(sent).toBe(1);

    cleanup();
    render(actions(send, cancel, true));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(cancelled).toBe(1);
  });

  test("shows a helpful message instead of unexpected HTML source", () => {
    const result: Result = {
      status: 200,
      statusText: "OK",
      elapsed: 10,
      headers: [["content-type", "text/html"]],
      text: "<!doctype html><html><body>Unexpected fallback</body></html>",
      bytes: 63,
      contentType: "text/html",
      finalUrl: "https://example.com/missing",
      redirected: false,
      chunks: 1,
      timeline: [{ time: 10, label: "Received" }],
      unexpectedHtml: true,
    };
    function Viewer() {
      const [tab, setTab] = useState<ResponseTab>("body");
      return <I18nProvider>
        <ResponseViewer result={result} responseTab={tab} setResponseTab={setTab} />
      </I18nProvider>;
    }

    render(<Viewer />);
    expect(screen.getByText("Unexpected HTML response")).toBeTruthy();
    expect(document.querySelector(".result-body")).toBeNull();
    expect(screen.queryByText(/Unexpected fallback/)).toBeNull();
    expect(screen.getByText("200")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /headers/i }));
    expect(document.querySelector(".doc-row")?.textContent).toContain("text/html");
  });

  test("switches JSON responses between formatted and exact raw text", () => {
    const response: Result = {
      status: 200, statusText: "OK", elapsed: 12,
      headers: [["content-type", "application/json"]],
      text: '{  "ok":true, "items":[1,2] }\n',
      bytes: 32, contentType: "application/json",
      finalUrl: "https://example.com/get",
      redirected: false, chunks: 1, timeline: [],
    };
    render(<I18nProvider>
      <ResponseViewer result={response} responseTab="body" setResponseTab={() => {}} />
    </I18nProvider>);
    expect(document.querySelector(".result-body")?.textContent).toContain('"ok": true');
    expect(screen.getByRole("button", { name: "Formatted" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Raw" }));
    expect(document.querySelector(".result-body")?.textContent).toBe(response.text);
    expect(screen.getByRole("button", { name: "Raw" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Formatted" }));
    expect(document.querySelector(".result-body")?.textContent).toContain('"items": [');
  });

  test("does not show the JSON view switch for plain text or binary content", () => {
    const plain: Result = {
      status: 200, statusText: "OK", elapsed: 1,
      headers: [["content-type", "text/plain"]], text: "hello",
      bytes: 5, contentType: "text/plain",
      finalUrl: "https://example.com/get",
      redirected: false, chunks: 1, timeline: [],
    };
    const { rerender } = render(<I18nProvider>
      <ResponseViewer result={plain} responseTab="body" setResponseTab={() => {}} />
    </I18nProvider>);
    expect(screen.queryByRole("button", { name: "Raw" })).toBeNull();
    rerender(<I18nProvider>
      <ResponseViewer result={{ ...plain, contentType: "application/octet-stream" }} responseTab="body" setResponseTab={() => {}} />
    </I18nProvider>);
    expect(screen.queryByRole("button", { name: "Raw" })).toBeNull();
  });

  test("shows response body and headers in the selected tab", () => {
    const response: Result = {
      status: 200,
      statusText: "OK",
      elapsed: 12,
      headers: [["content-type", "application/json"]],
      text: '{"ok":true}',
      bytes: 11,
      contentType: "application/json",
      finalUrl: "https://example.com/get",
      redirected: false,
      chunks: 1,
      timeline: [{ time: 12, label: "Received" }],
    };
    function Viewer() {
      const [tab, setTab] = useState<ResponseTab>("body");
      return <I18nProvider>
        <ResponseViewer result={response} responseTab={tab} setResponseTab={setTab} />
      </I18nProvider>;
    }

    render(<Viewer />);
    expect(document.querySelector(".result-body")?.textContent).toContain('"ok": true');
    fireEvent.click(screen.getByRole("tab", { name: /headers/i }));
    expect(document.querySelector(".doc-row")?.textContent).toContain("application/json");
    fireEvent.click(screen.getByRole("tab", { name: /timeline/i }));
    expect(document.querySelector(".timeline")?.textContent).toContain("Received");
  });
});
