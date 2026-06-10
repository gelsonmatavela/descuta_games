"use client";

import { useI18n } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/dictionaries";

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  const btn = (l: Locale, label: string) => (
    <button
      onClick={() => setLocale(l)}
      className={`rounded-full px-2.5 py-1 text-xs font-black transition ${
        locale === l ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
      }`}
      aria-pressed={locale === l}
    >
      {label}
    </button>
  );

  return (
    <div className="glass flex items-center gap-0.5 rounded-full p-0.5">
      {btn("pt", "PT")}
      {btn("en", "EN")}
    </div>
  );
}
