import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowRight, Check, ChevronDown, Copy, Play, RotateCw } from "lucide-react";
import type { Method } from "../../../shared/endpoints";
import { Button } from "../../components/ui/button";
import { useI18n } from "../../i18n";
import { formatRequest, loadRequestTool, requestTools, saveRequestTool, type RequestTool } from "./request-snippets";

interface Props {
  method: Method;
  makeRequest: () => { url: URL; requestHeaders: Headers; payload?: BodyInit };
  followRedirect: boolean;
  setFollowRedirect: (value: boolean) => void;
  loading: boolean;
  onSend: () => void;
  onCancel: () => void;
  errorMessage: string;
  onError: (message: string) => void;
}

function copy(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function RequestActions({ method, makeRequest, followRedirect, setFollowRedirect, loading, onSend, onCancel, errorMessage, onError }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<RequestTool>(() => loadRequestTool((key) => localStorage.getItem(key)));
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const copyMenuItemsRef = useRef<HTMLDivElement>(null);
  const copyMenuTriggerRef = useRef<HTMLButtonElement>(null);

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
    items[next]?.focus();
  };

  const copyRequest = async (tool: RequestTool) => {
    setToolMenuOpen(false);
    try {
      const request = makeRequest();
      await copy(formatRequest(tool, {
        url: request.url,
        method,
        headers: request.requestHeaders,
        ...(request.payload === undefined ? {} : { payload: request.payload }),
        followRedirects: followRedirect,
      }));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) { onError(error instanceof Error ? error.message : t("errorCopy")); }
  };

  const selectedToolLabel = requestTools.find((tool) => tool.id === selectedTool)?.label ?? "cURL";
  const copyButtonLabel = t("copyCurl").replace("cURL", selectedToolLabel);

  return (
    <>
          <label className="checkbox-row"><input type="checkbox" checked={followRedirect} onChange={(event) => setFollowRedirect(event.target.checked)} /> {t("followRedirects")}</label>
          <div className="request-actions">
            <div className="copy-split" ref={copyMenuRef}>
              <Button variant="secondary" size="small" className="copy-split-main" onClick={() => void copyRequest(selectedTool)}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t("copied") + " · " + selectedToolLabel : copyButtonLabel}</Button>
              <Button variant="secondary" size="small" className="copy-split-arrow" ref={copyMenuTriggerRef} aria-label={copyButtonLabel + " formats"} aria-haspopup="menu" aria-expanded={toolMenuOpen} onClick={() => setToolMenuOpen((open) => !open)}><ChevronDown size={14} aria-hidden="true" /></Button>
              {toolMenuOpen && <div className="copy-menu" role="menu" tabIndex={-1} ref={copyMenuItemsRef} aria-label={copyButtonLabel} onKeyDown={navigateCopyMenu}>
                {requestTools.map((tool) => <button type="button" key={tool.id} role="menuitem" aria-current={selectedTool === tool.id ? "true" : undefined} className="copy-menu-item" onClick={() => { setSelectedTool(tool.id); saveRequestTool(tool.id, (key, value) => localStorage.setItem(key, value)); void copyRequest(tool.id); }}>{tool.label}</button>)}
              </div>}
            </div>
            <Button variant="primary" className="send" disabled={loading} onClick={onSend}>{loading ? <RotateCw size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />}{loading ? t("sending") : t("send")}<ArrowRight size={15} /></Button>
            {loading && <Button variant="ghost" size="icon" aria-label={t("cancel")} onClick={onCancel}>×</Button>}
          </div>
          {errorMessage && <p className="tooltip-error" role="alert">{errorMessage}</p>}
    </>
  );
}
