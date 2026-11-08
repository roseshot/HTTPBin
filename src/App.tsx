import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  Activity, ArrowRight, Check, ChevronDown, ChevronRight, Clock3, Code2, Copy,
  FileJson2, Globe2, Info, Languages, Layers3, Moon, Play, Plus, RotateCw, Search,
  Send, ShieldCheck, Sun, Terminal, Trash2, Zap,
} from "lucide-react";
import { endpoints, groups, type Endpoint, type Method } from "../shared/endpoints";
import { Button } from "./components/ui/button";
import { formatRequest, requestTools, type RequestTool } from "./lib/request-snippets";
import { useI18n } from "./i18n";
import type { MessageKey } from "./i18n/schema";
import StandardsPage from "./StandardsPage";
import { TabsList, TabsPanel, TabsRoot, TabsTab } from "./components/ui/tabs";

type Theme = "dark" | "light";
const groupKeys: Record<Endpoint["group"], { title: MessageKey; description: MessageKey }> = {
  "HTTP Methods": { title: "groupMethods", description: "descriptionMethods" },
  "Request Inspection": { title: "groupInspection", description: "descriptionInspection" },
  Authentication: { title: "groupAuthentication", description: "descriptionAuthentication" },
  "Status Codes": { title: "groupStatus", description: "descriptionStatus" },
  Redirects: { title: "groupRedirects", description: "descriptionRedirects" },
  Cookies: { title: "groupCookies", description: "descriptionCookies" },
  "Response Formats": { title: "groupFormats", description: "descriptionFormats" },
  "Dynamic Data": { title: "groupData", description: "descriptionData" },
  Streaming: { title: "groupStreaming", description: "descriptionStreaming" },
  Caching: { title: "groupCaching", description: "descriptionCaching" },
  Images: { title: "groupImages", description: "descriptionImages" },
  Utilities: { title: "groupUtilities", description: "descriptionUtilities" },
};

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
  const { t } = useI18n();
  const update = (id: number, field: "key" | "value", value: string) =>
    onChange(rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
  return (
    <div>
      <div className="editor-label">{t("addHint")}</div>
      {rows.map((row) => (
        <div className="field-row" key={row.id}>
          <input className="field" aria-label={noun + " " + t("itemName")} placeholder={t("key")} value={row.key} onChange={(event) => update(row.id, "key", event.target.value)} />
          <input className="field" aria-label={noun + " " + t("itemValue")} placeholder={t("value")} value={row.value} onChange={(event) => update(row.id, "value", event.target.value)} />
          <Button size="icon" variant="ghost" aria-label={t("remove") + " " + noun.toLowerCase()} onClick={() => onChange(rows.filter((item) => item.id !== row.id))}><Trash2 size={14} /></Button>
        </div>
      ))}
      <button className="add-row" onClick={() => onChange([...rows, pair()])}><Plus size={13} /> {t("add")} {noun.toLowerCase()}</button>
    </div>
  );
}

function ExampleBody({ endpoint }: { endpoint: Endpoint }) {
  const { t } = useI18n();
  if (["/post", "/put", "/patch", "/anything"].includes(endpoint.path)) {
    return <div className="code-card">
      <div className="code-card-top"><span>{t("requestBody")} · application/json</span><span>{t("example")}</span></div>
      <pre>{'{\n  "hello": "world",\n  "source": "httpbin"\n}'}</pre>
    </div>;
  }
  return <div className="empty-note">{t("noRequestBody")}</div>;
}

export default function App() {
  const { locale, locales, setLocale, t, href, formatNumber } = useI18n();
  const groupTitle = (group: Endpoint["group"]) => t(groupKeys[group].title);
  const endpointTitle = (endpoint: Endpoint) => locale === "en" ? endpoint.summary : groupTitle(endpoint.group) + " · " + endpoint.path;
  const endpointDescription = (endpoint: Endpoint) => locale === "en" ? endpoint.description : t(groupKeys[endpoint.group].description);
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
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const copyMenuItemsRef = useRef<HTMLDivElement>(null);
  const copyMenuTriggerRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (!toolMenuOpen) return;
    copyMenuItemsRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!copyMenuRef.current?.contains(event.target as Node)) setToolMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setToolMenuOpen(false);
        copyMenuTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [toolMenuOpen]);

  const navigateCopyMenu = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(copyMenuItemsRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
      event.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
    items[next].focus();
  };

  const selectEndpoint = (endpoint: Endpoint) => {
    setToolMenuOpen(false);
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
       endpointTitle(endpoint).toLowerCase().includes(search.toLowerCase()) ||
      endpoint.group.toLowerCase().includes(search.toLowerCase()) ||
       groupTitle(endpoint.group).toLowerCase().includes(search.toLowerCase())
    )),
  })).filter((group) => group.items.length > 0);

  const makeRequest = useCallback(() => {
    if (!path.startsWith("/") || path.startsWith("//")) throw new Error(t("errorPath"));
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) throw new Error(t("errorCrossOrigin"));
    for (const item of params) if (item.key.trim()) url.searchParams.append(item.key.trim(), item.value);
    const requestHeaders = new Headers();
    for (const item of headers) if (item.key.trim()) requestHeaders.set(item.key.trim(), item.value);
    if (authType === "basic") requestHeaders.set("authorization", "Basic " + btoa(unescape(encodeURIComponent(username + ":" + password))));
    if (authType === "bearer") requestHeaders.set("authorization", "Bearer " + token);
    let payload: BodyInit | undefined;
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && bodyMode !== "none") {
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
  }, [path, params, headers, authType, username, password, token, method, bodyMode, body, formRows, t]);

  const sendRequest = useCallback(async () => {
    setErrorMessage("");
    let input: ReturnType<typeof makeRequest>;
    try { input = makeRequest(); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : t("errorRequest")); return; }
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
      const timeline: Timeline[] = [{ time: Math.round(performance.now() - start), label: t("headersReceived") }];
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
          timeline.push({ time: Math.round(performance.now() - start), label: t("chunk") + " " + count + " · " + formatNumber(value.byteLength) + " " + t("bytes") });
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
      const warning = response.type === "opaqueredirect" ? t("opaqueWarning") :
        response.redirected ? t("redirectWarning") : undefined;
      setResult({ status: response.status, statusText: response.statusText, elapsed: Math.round(performance.now() - start),
        headers: headersList, text, bytes: size, contentType: type, imageUrl, finalUrl: response.url, redirected: response.redirected, chunks: count, timeline, warning });
    } catch (error) {
      if (!controller.signal.aborted) setErrorMessage(error instanceof Error ? error.message : t("errorFailed"));
    } finally {
      if (controllerRef.current === controller) { setLoading(false); controllerRef.current = null; }
    }
  }, [makeRequest, method, followRedirect, formatNumber, t]);

  const copyRequest = async (tool: RequestTool) => {
    setToolMenuOpen(false);
    try {
      const request = makeRequest();
      await copy(formatRequest(tool, {
        url: request.url,
        method,
        headers: request.requestHeaders,
        payload: request.payload,
        followRedirects: followRedirect,
      }));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : t("errorCopy")); }
  };

  const showStandards = window.location.pathname === "/standards";

  return <div className={"shell" + (showStandards ? " standards-shell" : "")}>
    <header className="topbar">
      <a className="brand" href="/" aria-label="HTTPBin home"><span className="brand-icon"><Terminal size={20} strokeWidth={2.4} /></span><div>http<span>bin</span></div><span className="product-label">Workers Edition</span></a>
      <nav className="topbar-right" aria-label="Site navigation">
        <a className="top-link" href={href("/docs")}><Layers3 size={15} /><span>{t("apiExplorer")}</span></a>
        <a className="top-link" href="/openapi.json" target="_blank" rel="noreferrer"><FileJson2 size={15} /><span>OpenAPI</span></a>
        <a className="top-link" href={href("/standards")} aria-label={t("rfcTitle")} aria-current={showStandards ? "page" : undefined}><ShieldCheck size={15} /><span>{t("standards")}</span></a>
        <label className="language-picker"><Languages size={15} aria-hidden="true" /><select aria-label={t("language")} value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)}>{locales.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}</select></label>
        <span className="top-divider" />
        <button className="icon-button" aria-label={theme === "dark" ? t("themeLight") : t("themeDark")} onClick={toggleTheme}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
      </nav>
    </header>
    {showStandards ? <StandardsPage /> : <main className="workspace">
      <aside className="sidebar" aria-label="Endpoint navigation">
        <div className="sidebar-heading"><strong>{t("endpoints")}</strong><span className="counter">{formatNumber(endpoints.length)}</span></div>
        <div className="search-box"><Search size={15} /><input ref={searchRef} aria-label={t("search")} placeholder={t("search")} value={search} onChange={(event) => setSearch(event.target.value)} /><span className="shortcut">⌘K</span></div>
        {filteredGroups.map(({ group, items }) => {
          const collapsed = !search && closedGroups.includes(group);
          return <div className="nav-section" key={group}>
            <button className="nav-heading" onClick={() => setClosedGroups((current) => current.includes(group) ? current.filter((name) => name !== group) : [...current, group])}>
              <span>{groupTitle(group)}</span><span className="counter">{items.length}</span>{collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
            {!collapsed && items.map((endpoint) => <button key={endpoint.method + endpoint.path} className={"nav-item" + (selected === endpoint ? " active" : "")} onClick={() => selectEndpoint(endpoint)} title={endpointTitle(endpoint)}>
              {methodBadge(endpoint.method)}<span className="nav-path">{endpoint.path}</span>
            </button>)}
          </div>;
        })}
        {!filteredGroups.length && <p className="result-hint">{t("noMatch")}</p>}
      </aside>
      <article className="docs">
        <div className="breadcrumb"><span>HTTPBin</span><ChevronRight size={13} /><span>{groupTitle(selected.group)}</span><ChevronRight size={13} /><strong>{selected.path}</strong></div>
        <div className="eyebrow"><Zap size={13} /> {t("reference")}</div>
        <h1>{endpointTitle(selected)}</h1>
        <p className="docs-intro">{endpointDescription(selected)}</p>
        <div className="endpoint-heading">{methodBadge(selected.method)}<code className="path-code">{selected.path}</code></div>
        <div className="section">
          <h2 className="section-title">{t("parameters")}</h2>
          <p className="section-subtitle">{t("parametersHelp")}</p>
          {selected.parameters?.length ? <div className="doc-table">{selected.parameters.map((parameter) => <div className="doc-row" key={parameter.in + parameter.name}>
            <div><div><code>{parameter.name}</code><span className="mini-badge">{parameter.in}</span>{parameter.required && <span className="mini-badge required">{t("required")}</span>}</div>
              <p lang="en">{parameter.description}</p>{parameter.example && <code className="code-example">{t("example")}: {parameter.example}</code>}</div>
            <span className="mini-badge">string</span>
          </div>)}</div> : <div className="empty-note">{t("noParams")}</div>}
        </div>
        <div className="section"><h2 className="section-title">{t("requestBody")}</h2><p className="section-subtitle">{t("requestBodyHelp")}</p><ExampleBody endpoint={selected} /></div>
        <div className="section"><h2 className="section-title">{t("responses")}</h2>
          <div className="doc-table">
            <div className="doc-row"><div><code className="response-status">200</code><span className="mini-badge">{t("success")}</span><p>{t("successHelp")}</p></div><span className="mini-badge">HTTP</span></div>
            <div className="doc-row"><div><code>4xx / 5xx</code><p>{t("errorsHelp")}</p></div><span className="mini-badge">HTTP</span></div>
          </div>
        </div>
        <div className="info-callout"><Info size={16} /><div><strong>{t("runtime")}</strong><br />{t("runtimeHelp")} <a className="standards-inline-link" href={href("/standards")}>{t("rfcLink")} →</a></div></div>
        <div className="footer-note"><ShieldCheck size={14} /> {t("footDocs")}</div>
      </article>
      <section className="playground" aria-label="HTTP Playground">
        <div className="playground-header"><div className="panel-title"><Activity size={17} style={{ color: "var(--blue)" }} /> {t("playground")}</div><span className="live-pill"><span className="live-dot" /> {t("live")}</span></div>
        <div className="playground-scroller">
          <div className="caption"><Globe2 size={14} /> {t("request")}</div>
          <div className="request-bar">
            <select aria-label="HTTP method" value={method} onChange={(event) => setMethod(event.target.value as Method)}>{["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "QUERY"].map((value) => <option key={value}>{value}</option>)}</select>
            <input aria-label="Request path" value={path} onChange={(event) => setPath(event.target.value)} spellCheck={false} />
          </div>
          <div className="help-text"><Globe2 size={12} /><code>{window.location.origin}</code><span>·</span><span>{t("sameOrigin")}</span></div>
          <TabsRoot value={requestTab} onValueChange={(value) => setRequestTab(value as RequestTab)} className="request-tabs">
            <TabsList className="tab-list">{(["params", "headers", "body", "auth"] as const).map((value) => <TabsTab className="tab-trigger" value={value} key={value}>{t(value === "params" ? "params" : value === "headers" ? "headers" : value === "body" ? "body" : "auth")}</TabsTab>)}</TabsList>
            <TabsPanel value="params" className="tab-panel"><KeyValueEditor rows={params} onChange={setParams} noun={t("parameters")} /></TabsPanel>
            <TabsPanel value="headers" className="tab-panel"><KeyValueEditor rows={headers} onChange={setHeaders} noun={t("headers")} /></TabsPanel>
            <TabsPanel value="body" className="tab-panel">
              <div className="editor-label">{t("contentType")}</div>
              <select className="field" aria-label="Request body mode" value={bodyMode} onChange={(event) => setBodyMode(event.target.value as BodyMode)}>
                <option value="json">{t("json")}</option><option value="text">{t("plainText")}</option><option value="form">{t("form")}</option><option value="multipart">{t("multipart")}</option><option value="binary">{t("binary")}</option><option value="none">{t("noBody")}</option>
              </select>
              {bodyMode === "form" || bodyMode === "multipart" ? <div style={{ marginTop: 13 }}><KeyValueEditor rows={formRows} onChange={setFormRows} noun={t("value")} /></div> :
                bodyMode !== "none" ? <><div className="label">{t("payload")}</div><textarea spellCheck={false} aria-label="Request body" className="editor" value={body} onChange={(event) => setBody(event.target.value)} /></> :
                <p className="result-hint">{t("noBodyMessage")}</p>}
              {(method === "GET" || method === "HEAD" || method === "OPTIONS") && <p className="result-hint">{t("bodyGuard")}</p>}
            </TabsPanel>
            <TabsPanel value="auth" className="tab-panel">
              <div className="editor-label">{t("authScheme")}</div>
              <select className="field" value={authType} aria-label="Authorization type" onChange={(event) => setAuthType(event.target.value as "none" | "basic" | "bearer")}>
                <option value="none">{t("noAuth")}</option><option value="basic">{t("basicAuth")}</option><option value="bearer">{t("bearerToken")}</option>
              </select>
              {authType === "basic" && <><label className="label" htmlFor="username">{t("username")}</label><input className="field" id="username" value={username} onChange={(event) => setUsername(event.target.value)} /><label className="label" htmlFor="password">{t("password")}</label><input className="field" type="password" id="password" value={password} onChange={(event) => setPassword(event.target.value)} /></>}
              {authType === "bearer" && <><label className="label" htmlFor="token">{t("token")}</label><input className="field" type="password" id="token" value={token} onChange={(event) => setToken(event.target.value)} /></>}
              <p className="result-hint">{t("credentialsHint")}</p>
            </TabsPanel>
          </TabsRoot>
          <label className="checkbox-row"><input type="checkbox" checked={followRedirect} onChange={(event) => setFollowRedirect(event.target.checked)} /> {t("followRedirects")}</label>
          <div className="request-actions">
            <div className="copy-split" ref={copyMenuRef}>
              <Button variant="secondary" size="small" className="copy-split-main" onClick={() => void copyRequest("curl")}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t("copied") : t("copyCurl")}</Button>
              <Button variant="secondary" size="small" className="copy-split-arrow" ref={copyMenuTriggerRef} aria-label={t("copyCurl") + " formats"} aria-haspopup="menu" aria-expanded={toolMenuOpen} onClick={() => setToolMenuOpen((open) => !open)}><ChevronDown size={14} aria-hidden="true" /></Button>
              {toolMenuOpen && <div className="copy-menu" role="menu" ref={copyMenuItemsRef} aria-label={t("copyCurl")} onKeyDown={navigateCopyMenu}>
                {requestTools.map((tool) => <button type="button" key={tool.id} role="menuitem" className="copy-menu-item" onClick={() => void copyRequest(tool.id)}>{tool.label}</button>)}
              </div>}
            </div>
            <Button variant="primary" className="send" disabled={loading} onClick={() => void sendRequest()}>{loading ? <RotateCw size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />}{loading ? t("sending") : t("send")}<ArrowRight size={15} /></Button>
            {loading && <Button variant="ghost" size="icon" aria-label={t("cancel")} onClick={() => controllerRef.current?.abort()}>×</Button>}
          </div>
          {errorMessage && <p className="tooltip-error" role="alert">{errorMessage}</p>}
          <hr className="section-divider" />
          <div className="response-summary"><div className="caption" style={{ margin: 0 }}><Code2 size={14} /> {t("response")}</div>
            {result && <div className="response-meta"><span className={"response-code" + (result.status >= 400 || result.status === 0 ? " bad" : "")}>{result.status || "Opaque"}</span><span><Clock3 size={12} />{result.elapsed} ms</span><span>{formatNumber(result.bytes)} B</span></div>}
          </div>
          {result ? <TabsRoot value={responseTab} onValueChange={(value) => setResponseTab(value as ResponseTab)} className="response-tabs">
            <TabsList className="tab-list"><TabsTab className="tab-trigger" value="body">{t("body")}</TabsTab><TabsTab className="tab-trigger" value="headers">{t("headers")} <span className="counter">{result.headers.length}</span></TabsTab><TabsTab className="tab-trigger" value="timeline">{t("timeline")} <span className="counter">{result.chunks}</span></TabsTab></TabsList>
            <TabsPanel value="body" className="tab-panel">
              <div className="editor-label">{t("format")}: <strong>{contentKind(result.contentType)}</strong> · {result.contentType}</div>
              {result.imageUrl ? <img className="image-preview" src={result.imageUrl} alt={t("imagePreview")} /> :
                contentKind(result.contentType) === "BINARY" ? <div className="empty-note">{t("binaryReceived")} ({formatNumber(result.bytes)} B)</div> :
                <pre className="result-body">{pretty(result.text, result.contentType) || t("emptyBody")}</pre>}
              {result.warning && <p className="result-hint">{result.warning}</p>}
              {result.redirected && <p className="result-hint">{t("finalUrl")}: {result.finalUrl}</p>}
            </TabsPanel>
            <TabsPanel value="headers" className="tab-panel">
              <div className="doc-table">{result.headers.length ? result.headers.map(([key, value]) => <div className="doc-row" key={key}><code>{key}</code><span style={{ overflowWrap: "anywhere", color: "var(--muted)", fontSize: 11, textAlign: "right" }}>{value}</span></div>) : <div className="doc-row">{t("noHeaders")}</div>}</div>
            </TabsPanel>
            <TabsPanel value="timeline" className="tab-panel"><div className="timeline">{result.timeline.map((event, index) => <div className="timeline-item" key={index}><strong>{event.time} ms</strong>{event.label}</div>)}</div></TabsPanel>
          </TabsRoot> :
            <div className="response-placeholder" style={{ marginTop: 18 }}><Send size={23} /><strong>{t("responsePlaceholder")}</strong><p>{t("responsePlaceholderHelp")}</p></div>}
          <div className="footer-note"><ShieldCheck size={14} /> {t("footPlayground")}</div>
        </div>
      </section>
    </main>}
  </div>;
}
