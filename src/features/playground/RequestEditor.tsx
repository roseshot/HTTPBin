import type { Dispatch, SetStateAction } from "react";
import { Globe2, Plus, Trash2 } from "lucide-react";
import type { Method } from "../../../shared/endpoints";
import { Button } from "../../components/ui/button";
import { Dropdown } from "../../components/ui/dropdown";
import { TabsList, TabsPanel, TabsRoot, TabsTab } from "../../components/ui/tabs";
import { useI18n } from "../../i18n";
import { pair, type AuthType, type BodyMode, type Pair, type RequestTab } from "./types";

const requestMethods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "QUERY"] as const satisfies readonly Method[];
const requestTabs = ["params", "headers", "body", "auth"] as const satisfies readonly RequestTab[];

function isOption<T extends string>(options: readonly T[], value: string): value is T {
  return options.some((option) => option === value);
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

interface Props {
  method: Method;
  setMethod: Dispatch<SetStateAction<Method>>;
  path: string;
  setPath: Dispatch<SetStateAction<string>>;
  requestTab: RequestTab;
  setRequestTab: Dispatch<SetStateAction<RequestTab>>;
  params: Pair[];
  setParams: Dispatch<SetStateAction<Pair[]>>;
  headers: Pair[];
  setHeaders: Dispatch<SetStateAction<Pair[]>>;
  bodyMode: BodyMode;
  setBodyMode: Dispatch<SetStateAction<BodyMode>>;
  body: string;
  setBody: Dispatch<SetStateAction<string>>;
  formRows: Pair[];
  setFormRows: Dispatch<SetStateAction<Pair[]>>;
  authType: AuthType;
  setAuthType: Dispatch<SetStateAction<AuthType>>;
  username: string;
  setUsername: Dispatch<SetStateAction<string>>;
  password: string;
  setPassword: Dispatch<SetStateAction<string>>;
  token: string;
  setToken: Dispatch<SetStateAction<string>>;
}

export function RequestEditor({ method, setMethod, path, setPath, requestTab, setRequestTab, params, setParams, headers, setHeaders, bodyMode, setBodyMode, body, setBody, formRows, setFormRows, authType, setAuthType, username, setUsername, password, setPassword, token, setToken }: Props) {
  const { t } = useI18n();
  return (
    <>
          <div className="caption"><Globe2 size={14} /> {t("request")}</div>
          <div className="request-bar">
            <Dropdown ariaLabel="HTTP method" value={method} onChange={setMethod} options={requestMethods.map((value) => ({ value, label: value }))} variant="method" />
            <input aria-label="Request path" value={path} onChange={(event) => setPath(event.target.value)} spellCheck={false} />
          </div>
          <div className="help-text"><Globe2 size={12} /><code>{window.location.origin}</code><span>·</span><span>{t("sameOrigin")}</span></div>
          <TabsRoot value={requestTab} onValueChange={(value) => isOption(requestTabs, value) && setRequestTab(value)} className="request-tabs">
            <TabsList className="tab-list">{(["params", "headers", "body", "auth"] as const).map((value) => <TabsTab className="tab-trigger" value={value} key={value}>{t(value === "params" ? "params" : value === "headers" ? "headers" : value === "body" ? "body" : "auth")}</TabsTab>)}</TabsList>
            <TabsPanel value="params" className="tab-panel"><KeyValueEditor rows={params} onChange={setParams} noun={t("parameters")} /></TabsPanel>
            <TabsPanel value="headers" className="tab-panel"><KeyValueEditor rows={headers} onChange={setHeaders} noun={t("headers")} /></TabsPanel>
            <TabsPanel value="body" className="tab-panel">
              <div className="editor-label">{t("contentType")}</div>
              <Dropdown ariaLabel="Request body mode" value={bodyMode} onChange={setBodyMode} options={[
                { value: "json", label: t("json") },
                { value: "text", label: t("plainText") },
                { value: "form", label: t("form") },
                { value: "multipart", label: t("multipart") },
                { value: "binary", label: t("binary") },
                { value: "none", label: t("noBody") },
              ]} />
              {bodyMode === "form" || bodyMode === "multipart" ? <div style={{ marginTop: 13 }}><KeyValueEditor rows={formRows} onChange={setFormRows} noun={t("value")} /></div> :
                bodyMode !== "none" ? <><div className="label">{t("payload")}</div><textarea spellCheck={false} aria-label="Request body" className="editor" value={body} onChange={(event) => setBody(event.target.value)} /></> :
                <p className="result-hint">{t("noBodyMessage")}</p>}
              {(method === "GET" || method === "HEAD" || method === "OPTIONS") && <p className="result-hint">{t("bodyGuard")}</p>}
            </TabsPanel>
            <TabsPanel value="auth" className="tab-panel">
              <div className="editor-label">{t("authScheme")}</div>
              <Dropdown ariaLabel="Authorization type" value={authType} onChange={setAuthType} options={[
                { value: "none", label: t("noAuth") },
                { value: "basic", label: t("basicAuth") },
                { value: "bearer", label: t("bearerToken") },
              ]} />
              {authType === "basic" && <><label className="label" htmlFor="username">{t("username")}</label><input className="field" id="username" value={username} onChange={(event) => setUsername(event.target.value)} /><label className="label" htmlFor="password">{t("password")}</label><input className="field" type="password" id="password" value={password} onChange={(event) => setPassword(event.target.value)} /></>}
              {authType === "bearer" && <><label className="label" htmlFor="token">{t("token")}</label><input className="field" type="password" id="token" value={token} onChange={(event) => setToken(event.target.value)} /></>}
              <p className="result-hint">{t("credentialsHint")}</p>
            </TabsPanel>
          </TabsRoot>
    </>
  );
}
