"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dict, type Locale, type TKey } from "./dictionaries";

const STORAGE_KEY = "descuta-locale";

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  // Começa em "pt" (igual ao SSR) e ajusta no cliente para evitar mismatch.
  const [locale, setLocaleState] = useState<Locale>("pt");

  useEffect(() => {
    let initial: Locale = "pt";
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved === "pt" || saved === "en") initial = saved;
      else if (typeof navigator !== "undefined" && !navigator.language.startsWith("pt"))
        initial = "en";
    } catch {
      /* ignora */
    }
    setLocaleState(initial);
    document.documentElement.lang = initial === "pt" ? "pt-BR" : "en";
  }, []);

  function setLocale(l: Locale) {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignora */
    }
    document.documentElement.lang = l === "pt" ? "pt-BR" : "en";
  }

  function t(key: TKey, params?: Record<string, string | number>) {
    let s: string = dict[locale][key] ?? dict.pt[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
    }
    return s;
  }

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n deve ser usado dentro de I18nProvider");
  return ctx;
}
