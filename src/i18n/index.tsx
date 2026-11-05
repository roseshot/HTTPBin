import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, RTL_LOCALES, english, locales, resolveLocale, translate, type Locale, type MessageKey, type TranslationMap } from "./schema";

const loaders: Record<Exclude<Locale, "en">, () => Promise<{ default: TranslationMap }>> = {
  "zh-CN": () => import("./locales/zh-CN"), "zh-TW": () => import("./locales/zh-TW"),
  es: () => import("./locales/es"), fr: () => import("./locales/fr"), de: () => import("./locales/de"),
  "pt-BR": () => import("./locales/pt-BR"), ja: () => import("./locales/ja"), ko: () => import("./locales/ko"),
  ru: () => import("./locales/ru"), ar: () => import("./locales/ar"), hi: () => import("./locales/hi"),
  it: () => import("./locales/it"), nl: () => import("./locales/nl"), tr: () => import("./locales/tr"),
  id: () => import("./locales/id"), vi: () => import("./locales/vi"), th: () => import("./locales/th"),
};
const storageKey = "httpbin-locale";

export async function loadLocale(locale: Locale): Promise<TranslationMap> {
  if (locale === "en") return english;
  try { return (await loaders[locale]()).default; } catch { return english; }
}

function initialLocale(): Locale {
  const params = new URLSearchParams(location.search);
  let stored: string | null = null;
  try { stored = localStorage.getItem(storageKey); } catch { /* Storage may be disabled. */ }
  return resolveLocale(params.get("lang"), stored, navigator.languages ?? [navigator.language]);
}

type I18nContext = {
  locale: Locale;
  locales: typeof locales;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
  formatNumber: (value: number) => string;
  href: (path: string) => string;
};
const Context = createContext<I18nContext | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const [messages, setMessages] = useState<TranslationMap>(english);
  const [ready, setReady] = useState(locale === DEFAULT_LOCALE);

  useEffect(() => {
    let active = true;
    setReady(locale === DEFAULT_LOCALE);
    void loadLocale(locale).then((next) => { if (active) { setMessages(next); setReady(true); } });
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
    return () => { active = false; };
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    updateLocale(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Persistent storage is optional. */ }
    const current = new URL(location.href);
    current.searchParams.set("lang", next);
    history.replaceState(history.state, "", current.pathname + current.search + current.hash);
  }, []);

  const href = useCallback((path: string) => {
    const url = new URL(path, location.origin);
    url.searchParams.set("lang", locale);
    return url.pathname + url.search + url.hash;
  }, [locale]);

  const value = useMemo<I18nContext>(() => ({
    locale, locales, setLocale, href,
    t: (key) => translate(key, ready ? messages : english),
    formatNumber: (value) => new Intl.NumberFormat(locale).format(value),
  }), [locale, setLocale, href, ready, messages]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n(): I18nContext {
  const context = useContext(Context);
  if (!context) throw new Error("useI18n requires I18nProvider");
  return context;
}
