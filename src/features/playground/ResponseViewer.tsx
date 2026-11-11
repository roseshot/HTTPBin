import { useState, type Dispatch, type SetStateAction } from "react";
import { Clock3, Code2, Send, ShieldCheck } from "lucide-react";
import { TabsList, TabsPanel, TabsRoot, TabsTab } from "../../components/ui/tabs";
import { useI18n } from "../../i18n";
import type { Result, ResponseTab } from "./types";

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
interface Props {
  result: Result | null;
  responseTab: ResponseTab;
  setResponseTab: Dispatch<SetStateAction<ResponseTab>>;
}

export function ResponseViewer({ result, responseTab, setResponseTab }: Props) {
  const { t, formatNumber } = useI18n();
  const [jsonView, setJsonView] = useState<"formatted" | "raw">("formatted");
  return (
    <>
          <div className="response-summary"><div className="caption" style={{ margin: 0 }}><Code2 size={14} /> {t("response")}</div>
            {result && <div className="response-meta"><span className={"response-code" + (result.status >= 400 || result.status === 0 ? " bad" : "")}>{result.status || "Opaque"}</span><span><Clock3 size={12} />{result.elapsed} ms</span><span>{formatNumber(result.bytes)} B</span></div>}
          </div>
          {result ? <TabsRoot value={responseTab} onValueChange={(value) => (value === "body" || value === "headers" || value === "timeline") && setResponseTab(value)} className="response-tabs">
            <TabsList className="tab-list"><TabsTab className="tab-trigger" value="body">{t("body")}</TabsTab><TabsTab className="tab-trigger" value="headers">{t("headers")} <span className="counter">{result.headers.length}</span></TabsTab><TabsTab className="tab-trigger" value="timeline">{t("timeline")} <span className="counter">{result.chunks}</span></TabsTab></TabsList>
            <TabsPanel value="body" className="tab-panel">
              <div className="response-body-toolbar">
                <div className="editor-label">{t("format")}: <strong>{contentKind(result.contentType)}</strong> · {result.contentType}</div>
                {contentKind(result.contentType) === "JSON" && result.text.length > 0 && <fieldset className="json-view-switch" aria-label={t("format")}>
                  <button type="button" aria-pressed={jsonView === "formatted"} onClick={() => setJsonView("formatted")}>{t("formatted")}</button>
                  <button type="button" aria-pressed={jsonView === "raw"} onClick={() => setJsonView("raw")}>{t("raw")}</button>
                </fieldset>}
              </div>
              {result.unexpectedHtml ? <div className="response-placeholder" aria-live="polite"><strong>{t("unexpectedHtmlTitle")}</strong><p>{t("unexpectedHtmlHelp")}</p></div> :
                result.imageUrl ? <img className="image-preview" src={result.imageUrl} alt={t("imagePreview")} /> :
                contentKind(result.contentType) === "BINARY" ? <div className="empty-note">{t("binaryReceived")} ({formatNumber(result.bytes)} B)</div> :
                <pre className="result-body">{(jsonView === "raw" ? result.text : pretty(result.text, result.contentType)) || t("emptyBody")}</pre>}
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
    </>
  );
}
