"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

function Loading() {
  const { t } = useI18n();
  return <p className="text-center text-slate-400">{t("loading")}</p>;
}

const WarClient = dynamic(() => import("@/components/WarClient"), {
  ssr: false,
  loading: () => <Loading />,
});

export default function WarPage() {
  const { t } = useI18n();
  return (
    <main className="bg-deep min-h-screen px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </Link>
          <h1 className="text-xl font-bold">Warfront</h1>
          <span className="w-12" />
        </div>
        <WarClient />
      </div>
    </main>
  );
}
