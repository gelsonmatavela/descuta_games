"use client";

import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

const STORAGE_KEY = "descuta-cookie-consent";

export default function CookieConsent() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Mostra só se o usuário ainda não decidiu.
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch {
      /* localStorage indisponível — não bloqueia o site */
    }
  }, []);

  function decide(value: "accepted" | "rejected") {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignora */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4">
      <div className="glass mx-auto flex max-w-3xl flex-col items-start gap-3 rounded-2xl p-4 shadow-2xl sm:flex-row sm:items-center sm:gap-4">
        <Cookie className="hidden h-7 w-7 shrink-0 text-amber-300 sm:block" />
        <p className="flex-1 text-xs text-slate-300 sm:text-sm">{t("cookie_text")}</p>
        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
          <button
            onClick={() => decide("rejected")}
            className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/30 hover:text-white sm:flex-none"
          >
            {t("cookie_decline")}
          </button>
          <button
            onClick={() => decide("accepted")}
            className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-fuchsia-500 px-5 py-2 text-sm font-bold text-white transition hover:opacity-90 sm:flex-none"
          >
            {t("cookie_accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
