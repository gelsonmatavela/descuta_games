"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const GameClient = dynamic(() => import("@/components/GameClient"), {
  ssr: false,
  loading: () => <p className="text-center text-slate-400">Carregando o sofrimento...</p>,
});

export default function PlayPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Voltar
          </Link>
          <h1 className="text-xl font-bold">Plataforma Armadilha</h1>
          <span className="w-12" />
        </div>
        <GameClient />
      </div>
    </main>
  );
}
