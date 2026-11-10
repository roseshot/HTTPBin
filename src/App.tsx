import { useEffect, useRef, useState } from "react";
import {
  Activity, ChevronDown, ChevronRight, FileJson2, Info, Languages, Layers3,
  Moon, Search, ShieldCheck, Sun, Terminal, Zap,
} from "lucide-react";
import { endpoints, groups, type Endpoint, type Method } from "../shared/endpoints";
import { Dropdown } from "./components/ui/dropdown";
import { RequestActions } from "./features/playground/RequestActions";
import { RequestEditor } from "./features/playground/RequestEditor";
import { ResponseViewer } from "./features/playground/ResponseViewer";
import { useRequest } from "./features/playground/useRequest";
import { endpointRequestDefaults } from "./features/playground/request-defaults";
import { pair, type BodyMode, type Pair, type RequestTab, type ResponseTab, type AuthType } from "./features/playground/types";
import { useI18n } from "./i18n";
import type { MessageKey } from "./i18n/schema";
import StandardsPage from "./StandardsPage";

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

function methodBadge(method: Method) {
  return <span className={"method method-" + method}>{method}</span>;
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
    const fallback = endpoints[0];
    if (!fallback) throw new Error("Endpoint catalog must not be empty.");
    return endpoints.find((endpoint) => endpoint.path === selected) ?? fallback;
  })();
  const initialRequest = endpointRequestDefaults(initial);
  const [selected, setSelected] = useState<Endpoint>(initial);
  const [search, setSearch] = useState("");
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const [themeOverride, setThemeOverride] = useState<Theme | null>(savedTheme);
  const [systemTheme, setSystemTheme] = useState<Theme>(() => window.matchMedia(SYSTEM_DARK_QUERY).matches ? "dark" : "light");
  const theme = themeOverride ?? systemTheme;
  const [path, setPath] = useState(initialRequest.path);
  const [method, setMethod] = useState<Method>(initialRequest.method);
  const [requestTab, setRequestTab] = useState<RequestTab>("params");
  const [responseTab, setResponseTab] = useState<ResponseTab>("body");
  const [bodyMode, setBodyMode] = useState<BodyMode>(initialRequest.bodyMode);
  const [body, setBody] = useState(initialRequest.body);
  const [params, setParams] = useState<Pair[]>(() => initialRequest.params.map(({ key, value }) => pair(key, value)));
  const [headers, setHeaders] = useState<Pair[]>(() => initialRequest.headers.map(({ key, value }) => pair(key, value)));
  const [formRows, setFormRows] = useState<Pair[]>([pair()]);
  const [authType, setAuthType] = useState<AuthType>(initialRequest.authType);
  const [username, setUsername] = useState(initialRequest.username);
  const [password, setPassword] = useState(initialRequest.password);
  const [token, setToken] = useState(initialRequest.token);
  const [followRedirect, setFollowRedirect] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const { result, sentRequest, errorMessage, loading, setErrorMessage, makeRequest, sendRequest, cancelRequest, resetRequest } = useRequest({
    path, method, params, headers, authType, username, password, token, bodyMode, body, formRows, followRedirect,
    onResponseStart: () => setResponseTab("body"),
  });

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
  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  const selectEndpoint = (endpoint: Endpoint) => {
    const sample = endpointRequestDefaults(endpoint);
    resetRequest();
    setSelected(endpoint);
    setPath(sample.path);
    setMethod(sample.method);
    setParams(sample.params.map(({ key, value }) => pair(key, value)));
    setHeaders(sample.headers.map(({ key, value }) => pair(key, value)));
    setBodyMode(sample.bodyMode);
    setBody(sample.body);
    setFormRows([pair()]);
    setAuthType(sample.authType);
    setUsername(sample.username);
    setPassword(sample.password);
    setToken(sample.token);
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

  const showStandards = window.location.pathname === "/standards";

  return <div className={"shell" + (showStandards ? " standards-shell" : "")}>
    <header className="topbar">
      <a className="brand" href="/" aria-label="HTTPBin home"><span className="brand-icon"><Terminal size={20} strokeWidth={2.4} /></span><div>http<span>bin</span></div><span className="product-label">Runs on Cloudflare Workers</span></a>
      <nav className="topbar-right" aria-label="Site navigation">
        <a className="top-link" href={href("/docs")}><Layers3 size={15} /><span>{t("apiExplorer")}</span></a>
        <a className="top-link" href="/openapi.json" target="_blank" rel="noreferrer"><FileJson2 size={15} /><span>OpenAPI</span></a>
        <a className="top-link" href={href("/standards")} aria-label={t("rfcTitle")} aria-current={showStandards ? "page" : undefined}><ShieldCheck size={15} /><span>{t("standards")}</span></a>
        <div className="language-picker"><Languages size={15} aria-hidden="true" /><Dropdown ariaLabel={t("language")} value={locale} onChange={setLocale} options={locales.map(({ code, name }) => ({ value: code, label: name }))} variant="language" /></div>
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
          <RequestEditor method={method} setMethod={setMethod} path={path} setPath={setPath} requestTab={requestTab} setRequestTab={setRequestTab}
            params={params} setParams={setParams} headers={headers} setHeaders={setHeaders} bodyMode={bodyMode} setBodyMode={setBodyMode}
            body={body} setBody={setBody} formRows={formRows} setFormRows={setFormRows} authType={authType} setAuthType={setAuthType}
            username={username} setUsername={setUsername} password={password} setPassword={setPassword} token={token} setToken={setToken} />
          <RequestActions method={method} sentRequest={sentRequest} result={result} makeRequest={makeRequest} followRedirect={followRedirect} setFollowRedirect={setFollowRedirect} loading={loading}
            onSend={() => void sendRequest()} onCancel={cancelRequest} errorMessage={errorMessage} onError={setErrorMessage} />
          <hr className="section-divider" />
          <ResponseViewer result={result} responseTab={responseTab} setResponseTab={setResponseTab} />
        </div>
      </section>
    </main>}
  </div>;
}
