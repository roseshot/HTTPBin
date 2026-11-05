import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, ArrowRight, Check, ChevronDown, ChevronRight, Clock3, Code2, Copy,
  FileJson2, Globe2, Info, Layers3, Moon, Play, Plus, RotateCw, Search,
  Send, ShieldCheck, Sun, Terminal, Trash2, Zap,
} from "lucide-react";
import { endpoints, groups, type Endpoint, type Method } from "../shared/endpoints";
import { Button } from "./components/ui/button";
import { TabsList, TabsPanel, TabsRoot, TabsTab } from "./components/ui/tabs";

type Theme = "dark" | "light";
const THEME_KEY = "httpbin-theme";
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

type Pair = { id: number; key: string; value: string };
type RequestTab = "params" | "headers" | "body" | "auth";
type ResponseTab = "body" | "headers" | "timeline";
type BodyMode = "json" | "text" | "form" | "multipart" | "binary" | "none";
type Timeline = { time: number; label: string };
type Result = {
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
};
let nextPairId = 0;
function pair(key = "", value = ""): Pair { return { id: ++nextPairId, key, value }; }
function pathFor(endpoint: Endpoint): string {
  if (endpoint.example) return endpoint.example;
  return endpoint.path.replace(/\{([^}]+)\}/g, (_match, name: string) => endpoint.parameters?.find((item) => item.name === name)?.example || "1");
}
function pretty(text: string, contentType: string): string {
  if (!contentType.includes("json")) return text;
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}
function contentKind(contentType: string) {
  if (contentType.includes("json")) return "JSON";
  if (contentType.startsWith("image/")) return "IMAGE";
  if (contentType.includes("text/") || contentType.includes("xml")) return "TEXT";
  return "BINARY";
}
function copy(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
function methodBadge(method: Method) {
  return <span className={"method method-" + method}>{method}</span>;
}

function KeyValueEditor({ rows, onChange, noun }: { rows: Pair[]; onChange: (rows: Pair[]) => void; noun: string }) {
  const update = (id: number, field: "key" | "value", value: string) =>
    onChange(rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
  return (
    <div>
      <div className="editor-label">Add {noun.toLowerCase()} to your request.</div>
      {rows.map((row) => (
        <div className="field-row" key={row.id}>
          <input className="field" aria-label={noun + " name"} placeholder="Key" value={row.key} onChange={(event) => update(row.id, "key", event.target.value)} />
          <input className="field" aria-label={noun + " value"} placeholder="Value" value={row.value} onChange={(event) => update(row.id, "value", event.target.value)} />
          <Button size="icon" variant="ghost" aria-label={"Remove " + noun.toLowerCase()} onClick={() => onChange(rows.filter((item) => item.id !== row.id))}><Trash2 size={14} /></Button>
        </div>
      ))}
      <button className="add-row" onClick={() => onChange([...rows, pair()])}><Plus size={13} /> Add {noun.toLowerCase()}</button>
    </div>
  );
}

function ExampleBody({ endpoint }: { endpoint: Endpoint }) {
  if (["/post", "/put", "/patch", "/anything"].includes(endpoint.path)) {
    return <div className="code-card">
      <div className="code-card-top"><span>Request body · application/json</span><span>Example</span></div>
      <pre>{'{\n  "hello": "world",\n  "source": "httpbin"\n}'}</pre>
    </div>;
  }
  return <div className="empty-note">No request body is required for this endpoint.</div>;
}

export default function App() {
  const initial = (() => {
    const selected = new URLSearchParams(window.location.search).get("endpoint");
    return endpoints.find((endpoint) => endpoint.path === selected) || endpoints[0];
  })();
  const [selected, setSelected] = useState<Endpoint>(initial);
  const [search, setSearch] = useState("");
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const [themeOverride, setThemeOverride] = useState<Theme | null>(savedTheme);
  const [systemTheme, setSystemTheme] = useState<Theme>(() => window.matchMedia(SYSTEM_DARK_QUERY).matches ? "dark" : "light");
  const theme = themeOverride ?? systemTheme;
  const [path, setPath] = useState(pathFor(initial));
  const [method, setMethod] = useState<Method>(initial.method === "ANY" ? "GET" : initial.method);
  const [requestTab, setRequestTab] = useState<RequestTab>("params");
  const [responseTab, setResponseTab] = useState<ResponseTab>("body");
  const [bodyMode, setBodyMode] = useState<BodyMode>("json");
  const [body, setBody] = useState('{\n  "hello": "world"\n}');
  const [params, setParams] = useState<Pair[]>([]);
  const [headers, setHeaders] = useState<Pair[]>([]);
  const [formRows, setFormRows] = useState<Pair[]>([pair()]);
  const [authType, setAuthType] = useState<"none" | "basic" | "bearer">("none");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [followRedirect, setFollowRedirect] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const abortOnUnmount = useRef<AbortController | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0b101a" : "#f4f7fb");
  }, [theme]);
  useEffect(() => {
    const media = window.matchMedia(SYSTEM_DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) setThemeOverride(savedTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setThemeOverride(nextTheme);
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch {
      // Continue with the in-memory theme when storage is unavailable.
    }
  };
  useEffect(() => () => { abortOnUnmount.current?.abort(); }, []);
  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);
  useEffect(() => () => {
    if (result?.imageUrl) URL.revokeObjectURL(result.imageUrl);
  }, [result?.imageUrl]);

  const selectEndpoint = (endpoint: Endpoint) => {
    controllerRef.current?.abort();
    setSelected(endpoint);
    setPath(pathFor(endpoint));
    setMethod(endpoint.method === "ANY" ? "GET" : endpoint.method);
    setParams([]);
    setHeaders([]);
    setResult(null);
    setErrorMessage("");
    setAuthType("none");
    const url = new URL(window.location.href);
    url.searchParams.set("endpoint", endpoint.path);
    window.history.replaceState(null, "", url.pathname + url.search);
  };
  const filteredGroups = groups.map((group) => ({
    group,
    items: endpoints.filter((endpoint) => endpoint.group === group && (
      endpoint.path.toLowerCase().includes(search.toLowerCase()) ||
      endpoint.summary.toLowerCase().includes(search.toLowerCase()) ||
      endpoint.group.toLowerCase().includes(search.toLowerCase())
    )),
  })).filter((group) => group.items.length > 0);

  const makeRequest = useCallback(() => {
    if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Use a same-origin path beginning with /.");
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) throw new Error("Cross-origin requests are not supported.");
    for (const item of params) if (item.key.trim()) url.searchParams.append(item.key.trim(), item.value);
    const requestHeaders = new Headers();
    for (const item of headers) if (item.key.trim()) requestHeaders.set(item.key.trim(), item.value);
    if (authType === "basic") requestHeaders.set("authorization", "Basic " + btoa(unescape(encodeURIComponent(username + ":" + password))));
    if (authType === "bearer") requestHeaders.set("authorization", "Bearer " + token);
    let payload: BodyInit | undefined;
    if (method !== "GET" && bodyMode !== "none") {
      if (bodyMode === "json") { requestHeaders.set("content-type", "application/json"); payload = body; }
      else if (bodyMode === "text") { requestHeaders.set("content-type", "text/plain; charset=utf-8"); payload = body; }
      else if (bodyMode === "binary") { requestHeaders.set("content-type", "application/octet-stream"); payload = body; }
      else if (bodyMode === "form") {
        const data = new URLSearchParams();
        for (const item of formRows) if (item.key) data.append(item.key, item.value);
        payload = data;
        requestHeaders.set("content-type", "application/x-www-form-urlencoded");
      } else if (bodyMode === "multipart") {
        const data = new FormData();
        for (const item of formRows) if (item.key) data.append(item.key, item.value);
        payload = data;
        requestHeaders.delete("content-type");
      }
    }
    return { url, requestHeaders, payload };
  }, [path, params, headers, authType, username, password, token, method, bodyMode, body, formRows]);

  const sendRequest = useCallback(async () => {
    setErrorMessage("");
    let input: ReturnType<typeof makeRequest>;
    try { input = makeRequest(); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : "Invalid request."); return; }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    abortOnUnmount.current = controller;
    setLoading(true);
    setResult(null);
    setResponseTab("body");
    const start = performance.now();
    try {
      const response = await fetch(input.url, {
        method, headers: input.requestHeaders, body: input.payload, redirect: followRedirect ? "follow" : "manual", signal: controller.signal,
      });
      const headersList = Array.from(response.headers.entries());
      const type = response.headers.get("content-type") || "application/octet-stream";
      let text = "";
      let count = 0;
      let size = 0;
      const chunks: Uint8Array[] = [];
      const timeline: Timeline[] = [{ time: Math.round(performance.now() - start), label: "Response headers received" }];
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          count++;
          chunks.push(value);
          if (!type.startsWith("image/") && size < 2 * 1024 * 1024) text += decoder.decode(value, { stream: true });
          timeline.push({ time: Math.round(performance.now() - start), label: "Chunk " + count + " · " + value.byteLength + " bytes" });
          if (!type.startsWith("image/")) {
            setResult({ status: response.status, statusText: response.statusText, elapsed: Math.round(performance.now() - start), headers: headersList,
              text, bytes: size, contentType: type, finalUrl: response.url, redirected: response.redirected, chunks: count, timeline: [...timeline] });
          }
        }
        text += decoder.decode();
      }
      let imageUrl: string | undefined;
      if (type.startsWith("image/") && chunks.length) {
        const merged = new Uint8Array(size);
        let index = 0;
        for (const chunk of chunks) { merged.set(chunk, index); index += chunk.byteLength; }
        imageUrl = URL.createObjectURL(new Blob([merged.buffer as ArrayBuffer], { type }));
      }
      const warning = response.type === "opaqueredirect" ? "Browser Fetch hides the status and Location of manually handled redirects." :
        response.redirected ? "The browser automatically followed redirects. Intermediate responses are not visible." : undefined;
      setResult({ status: response.status, statusText: response.statusText, elapsed: Math.round(performance.now() - start),
        headers: headersList, text, bytes: size, contentType: type, imageUrl, finalUrl: response.url, redirected: response.redirected, chunks: count, timeline, warning });
    } catch (error) {
      if (!controller.signal.aborted) setErrorMessage(error instanceof Error ? error.message : "Request failed.");
    } finally {
      if (controllerRef.current === controller) { setLoading(false); controllerRef.current = null; }
    }
  }, [makeRequest, method, followRedirect]);

  const copyCurl = async () => {
    try {
      const request = makeRequest();
      const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
      const args = ["curl", "-i", "-X", method, quote(request.url.href)];
      for (const [key, value] of request.requestHeaders) args.push("-H", quote(key + ": " + value));
      if (typeof request.payload === "string") args.push("--data-raw", quote(request.payload));
      else if (request.payload instanceof URLSearchParams) args.push("--data-raw", quote(request.payload.toString()));
      else if (request.payload instanceof FormData) for (const [key, value] of request.payload) args.push("-F", quote(key + "=" + value));
      if (followRedirect) args.push("-L");
      await copy(args.join(" "));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Unable to copy request."); }
  };

  return <div className="shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="HTTPBin home"><span className="brand-icon"><Terminal size={20} strokeWidth={2.4} /></span><div>http<span>bin</span></div><span className="product-label">Workers Edition</span></a>
      <nav className="topbar-right" aria-label="Site navigation">
        <a className="top-link" href="/docs"><Layers3 size={15} /><span>API Explorer</span></a>
        <a className="top-link" href="/openapi.json" target="_blank" rel="noreferrer"><FileJson2 size={15} /><span>OpenAPI</span></a>
        <span className="top-divider" />
        <button className="icon-button" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
      </nav>
    </header>
    <main className="workspace">
      <aside className="sidebar" aria-label="Endpoint navigation">
        <div className="sidebar-heading"><strong>API ENDPOINTS</strong><span className="counter">{endpoints.length} endpoints</span></div>
        <div className="search-box"><Search size={15} /><input ref={searchRef} aria-label="Search endpoints" placeholder="Search endpoints..." value={search} onChange={(event) => setSearch(event.target.value)} /><span className="shortcut">⌘K</span></div>
        {filteredGroups.map(({ group, items }) => {
          const collapsed = !search && closedGroups.includes(group);
          return <div className="nav-section" key={group}>
            <button className="nav-heading" onClick={() => setClosedGroups((current) => current.includes(group) ? current.filter((name) => name !== group) : [...current, group])}>
              <span>{group}</span><span className="counter">{items.length}</span>{collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
            {!collapsed && items.map((endpoint) => <button key={endpoint.method + endpoint.path} className={"nav-item" + (selected === endpoint ? " active" : "")} onClick={() => selectEndpoint(endpoint)} title={endpoint.summary}>
              {methodBadge(endpoint.method)}<span className="nav-path">{endpoint.path}</span>
            </button>)}
          </div>;
        })}
        {!filteredGroups.length && <p className="result-hint">No matching endpoints.</p>}
      </aside>
      <article className="docs">
        <div className="breadcrumb"><span>HTTPBin</span><ChevronRight size={13} /><span>{selected.group}</span><ChevronRight size={13} /><strong>{selected.path}</strong></div>
        <div className="eyebrow"><Zap size={13} /> HTTP API Reference</div>
        <h1>{selected.summary}</h1>
        <p className="docs-intro">{selected.description}</p>
        <div className="endpoint-heading">{methodBadge(selected.method)}<code className="path-code">{selected.path}</code></div>
        <div className="section">
          <h2 className="section-title">Parameters</h2>
          <p className="section-subtitle">Configure these values in the request URL or the playground.</p>
          {selected.parameters?.length ? <div className="doc-table">{selected.parameters.map((parameter) => <div className="doc-row" key={parameter.in + parameter.name}>
            <div><div><code>{parameter.name}</code><span className="mini-badge">{parameter.in}</span>{parameter.required && <span className="mini-badge required">required</span>}</div>
              <p>{parameter.description}</p>{parameter.example && <code className="code-example">Example: {parameter.example}</code>}</div>
            <span className="mini-badge">string</span>
          </div>)}</div> : <div className="empty-note">No declared parameters. You can still append custom query parameters or headers.</div>}
        </div>
        <div className="section"><h2 className="section-title">Request body</h2><p className="section-subtitle">Supported payloads depend on the HTTP method.</p><ExampleBody endpoint={selected} /></div>
        <div className="section"><h2 className="section-title">Responses</h2>
          <div className="doc-table">
            <div className="doc-row"><div><code className="response-status">200</code><span className="mini-badge">Success</span><p>Response body and headers vary by endpoint and test parameters.</p></div><span className="mini-badge">HTTP</span></div>
            <div className="doc-row"><div><code>4xx / 5xx</code><p>Expected HTTP error codes are returned as responses, not application failures.</p></div><span className="mini-badge">HTTP</span></div>
          </div>
        </div>
        <div className="info-callout"><Info size={16} /><div><strong>Cloudflare Workers compatibility</strong><br />Some wire-level headers, compression behavior, and redirect details are controlled by the Workers runtime or browser. Use cURL for tests requiring raw HTTP semantics.</div></div>
        <div className="footer-note"><ShieldCheck size={14} /> Stateless by design · Runs on Cloudflare Workers · OpenAPI 3.1</div>
      </article>
      <section className="playground" aria-label="HTTP Playground">
        <div className="playground-header"><div className="panel-title"><Activity size={17} style={{ color: "var(--blue)" }} /> HTTP Playground</div><span className="live-pill"><span className="live-dot" /> LIVE</span></div>
        <div className="playground-scroller">
          <div className="caption"><Globe2 size={14} /> Request</div>
          <div className="request-bar">
            <select aria-label="HTTP method" value={method} onChange={(event) => setMethod(event.target.value as Method)}>{["GET", "POST", "PUT", "PATCH", "DELETE"].map((value) => <option key={value}>{value}</option>)}</select>
            <input aria-label="Request path" value={path} onChange={(event) => setPath(event.target.value)} spellCheck={false} />
          </div>
          <div className="help-text"><Globe2 size={12} /><code>{window.location.origin}</code><span>·</span><span>Same-origin requests only</span></div>
          <TabsRoot value={requestTab} onValueChange={(value) => setRequestTab(value as RequestTab)} className="request-tabs">
            <TabsList className="tab-list">{(["params", "headers", "body", "auth"] as const).map((value) => <TabsTab className="tab-trigger" value={value} key={value}>{value === "params" ? "Params" : value === "headers" ? "Headers" : value === "body" ? "Body" : "Auth"}</TabsTab>)}</TabsList>
            <TabsPanel value="params" className="tab-panel"><KeyValueEditor rows={params} onChange={setParams} noun="Parameter" /></TabsPanel>
            <TabsPanel value="headers" className="tab-panel"><KeyValueEditor rows={headers} onChange={setHeaders} noun="Header" /></TabsPanel>
            <TabsPanel value="body" className="tab-panel">
              <div className="editor-label">Content type</div>
              <select className="field" aria-label="Request body mode" value={bodyMode} onChange={(event) => setBodyMode(event.target.value as BodyMode)}>
                <option value="json">JSON</option><option value="text">Plain text</option><option value="form">Form URL encoded</option><option value="multipart">Multipart form</option><option value="binary">Binary (UTF-8 bytes)</option><option value="none">No body</option>
              </select>
              {bodyMode === "form" || bodyMode === "multipart" ? <div style={{ marginTop: 13 }}><KeyValueEditor rows={formRows} onChange={setFormRows} noun="Field" /></div> :
                bodyMode !== "none" ? <><div className="label">Request payload</div><textarea spellCheck={false} aria-label="Request body" className="editor" value={body} onChange={(event) => setBody(event.target.value)} /></> :
                <p className="result-hint">No request body will be sent.</p>}
              {(method === "GET" || method === "DELETE") && <p className="result-hint">Body editing is available for POST, PUT, and PATCH requests.</p>}
            </TabsPanel>
            <TabsPanel value="auth" className="tab-panel">
              <div className="editor-label">Authorization scheme</div>
              <select className="field" value={authType} aria-label="Authorization type" onChange={(event) => setAuthType(event.target.value as "none" | "basic" | "bearer")}>
                <option value="none">No authentication</option><option value="basic">Basic authentication</option><option value="bearer">Bearer token</option>
              </select>
              {authType === "basic" && <><label className="label" htmlFor="username">Username</label><input className="field" id="username" value={username} onChange={(event) => setUsername(event.target.value)} /><label className="label" htmlFor="password">Password</label><input className="field" type="password" id="password" value={password} onChange={(event) => setPassword(event.target.value)} /></>}
              {authType === "bearer" && <><label className="label" htmlFor="token">Token</label><input className="field" type="password" id="token" value={token} onChange={(event) => setToken(event.target.value)} /></>}
              <p className="result-hint">Credentials remain in this browser session and are never stored by the playground.</p>
            </TabsPanel>
          </TabsRoot>
          <label className="checkbox-row"><input type="checkbox" checked={followRedirect} onChange={(event) => setFollowRedirect(event.target.checked)} /> Automatically follow redirects</label>
          <div className="request-actions">
            <Button variant="secondary" size="small" onClick={copyCurl}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy cURL"}</Button>
            <Button variant="primary" className="send" disabled={loading} onClick={() => void sendRequest()}>{loading ? <RotateCw size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />}{loading ? "Sending..." : "Send Request"}<ArrowRight size={15} /></Button>
            {loading && <Button variant="ghost" size="icon" aria-label="Cancel request" onClick={() => controllerRef.current?.abort()}>×</Button>}
          </div>
          {errorMessage && <p className="tooltip-error" role="alert">{errorMessage}</p>}
          <hr className="section-divider" />
          <div className="response-summary"><div className="caption" style={{ margin: 0 }}><Code2 size={14} /> Response</div>
            {result && <div className="response-meta"><span className={"response-code" + (result.status >= 400 || result.status === 0 ? " bad" : "")}>{result.status || "Opaque"}</span><span><Clock3 size={12} />{result.elapsed} ms</span><span>{result.bytes.toLocaleString()} B</span></div>}
          </div>
          {result ? <TabsRoot value={responseTab} onValueChange={(value) => setResponseTab(value as ResponseTab)} className="response-tabs">
            <TabsList className="tab-list"><TabsTab className="tab-trigger" value="body">Body</TabsTab><TabsTab className="tab-trigger" value="headers">Headers <span className="counter">{result.headers.length}</span></TabsTab><TabsTab className="tab-trigger" value="timeline">Timeline <span className="counter">{result.chunks}</span></TabsTab></TabsList>
            <TabsPanel value="body" className="tab-panel">
              <div className="editor-label">Format: <strong>{contentKind(result.contentType)}</strong> · {result.contentType}</div>
              {result.imageUrl ? <img className="image-preview" src={result.imageUrl} alt="Response preview" /> :
                contentKind(result.contentType) === "BINARY" ? <div className="empty-note">Binary response received: {result.bytes} bytes. Use cURL to inspect the raw bytes.</div> :
                <pre className="result-body">{pretty(result.text, result.contentType) || "(empty response body)"}</pre>}
              {result.warning && <p className="result-hint">{result.warning}</p>}
              {result.redirected && <p className="result-hint">Final URL: {result.finalUrl}</p>}
            </TabsPanel>
            <TabsPanel value="headers" className="tab-panel">
              <div className="doc-table">{result.headers.length ? result.headers.map(([key, value]) => <div className="doc-row" key={key}><code>{key}</code><span style={{ overflowWrap: "anywhere", color: "var(--muted)", fontSize: 11, textAlign: "right" }}>{value}</span></div>) : <div className="doc-row">No response headers are exposed.</div>}</div>
            </TabsPanel>
            <TabsPanel value="timeline" className="tab-panel"><div className="timeline">{result.timeline.map((event, index) => <div className="timeline-item" key={index}><strong>{event.time} ms</strong>{event.label}</div>)}</div></TabsPanel>
          </TabsRoot> :
            <div className="response-placeholder" style={{ marginTop: 18 }}><Send size={23} /><strong>Your response will appear here</strong><p>Configure a request and select Send Request.</p></div>}
          <div className="footer-note"><ShieldCheck size={14} /> Requests run directly in your browser against this Worker.</div>
        </div>
      </section>
    </main>
  </div>;
}
