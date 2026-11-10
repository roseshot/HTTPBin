import { useCallback, useEffect, useRef, useState } from "react";
import type { Method } from "../../../shared/endpoints";
import { useI18n } from "../../i18n";
import type { AuthType, BodyMode, Pair, Result, Timeline } from "./types";
import { isUnexpectedHtmlResponse } from "./response-content";
import { captureRequest, type CapturedRequest } from "./request-exchange";

interface RequestConfig {
  path: string;
  method: Method;
  params: Pair[];
  headers: Pair[];
  authType: AuthType;
  username: string;
  password: string;
  token: string;
  bodyMode: BodyMode;
  body: string;
  formRows: Pair[];
  followRedirect: boolean;
  onResponseStart: () => void;
}

export function useRequest({ path, method, params, headers, authType, username, password, token, bodyMode, body, formRows, followRedirect, onResponseStart }: RequestConfig) {
  const { t, formatNumber } = useI18n();
  const [result, setResult] = useState<Result | null>(null);
  const [sentRequest, setSentRequest] = useState<CapturedRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const abortOnUnmount = useRef<AbortController | null>(null);

  useEffect(() => () => { abortOnUnmount.current?.abort(); }, []);
  useEffect(() => () => {
    if (result?.imageUrl) URL.revokeObjectURL(result.imageUrl);
  }, [result?.imageUrl]);

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
    return { url, requestHeaders, ...(payload === undefined ? {} : { payload }) };
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
    setSentRequest(captureRequest(input.url, method, input.requestHeaders, input.payload));
    onResponseStart();
    const start = performance.now();
    try {
      const response = await fetch(input.url, {
        method, headers: input.requestHeaders, ...(input.payload === undefined ? {} : { body: input.payload }),
        redirect: followRedirect ? "follow" : "manual", signal: controller.signal,
      });
      const headersList = Array.from(response.headers.entries());
      const type = response.headers.get("content-type") || "application/octet-stream";
      const unexpectedHtml = isUnexpectedHtmlResponse(type, response.status, input.url.pathname);
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
          if (!type.startsWith("image/") && !unexpectedHtml && size < 2 * 1024 * 1024) text += decoder.decode(value, { stream: true });
          timeline.push({ time: Math.round(performance.now() - start), label: t("chunk") + " " + count + " · " + formatNumber(value.byteLength) + " " + t("bytes") });
          if (!type.startsWith("image/")) {
            setResult({ status: response.status, statusText: response.statusText, elapsed: Math.round(performance.now() - start), headers: headersList,
              text, bytes: size, contentType: type, finalUrl: response.url, redirected: response.redirected, chunks: count,
              timeline: [...timeline], unexpectedHtml });
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
        headers: headersList, text, bytes: size, contentType: type, ...(imageUrl === undefined ? {} : { imageUrl }),
        finalUrl: response.url, redirected: response.redirected, chunks: count, timeline, unexpectedHtml,
        ...(warning === undefined ? {} : { warning }) });
    } catch (error) {
      if (!controller.signal.aborted) setErrorMessage(error instanceof Error ? error.message : t("errorFailed"));
    } finally {
      if (controllerRef.current === controller) { setLoading(false); controllerRef.current = null; }
    }
  }, [makeRequest, method, followRedirect, formatNumber, t, onResponseStart]);

  const cancelRequest = () => controllerRef.current?.abort();
  const resetRequest = () => {
    controllerRef.current?.abort();
    setResult(null);
    setSentRequest(null);
    setErrorMessage("");
  };

  return { result, sentRequest, errorMessage, loading, setErrorMessage, makeRequest, sendRequest, cancelRequest, resetRequest };
}
