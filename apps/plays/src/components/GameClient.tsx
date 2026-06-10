"use client";

import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { api, getToken } from "@/lib/api";

const SLUG = "trap-adventure";

type Overlay =
  | { kind: "none" }
  | { kind: "death"; taunt: string }
  | { kind: "win"; deaths: number; seconds: number };

export default function GameClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [deaths, setDeaths] = useState(0);
  const [level, setLevel] = useState<{ index: number; total: number; name: string }>({
    index: 0,
    total: 1,
    name: "",
  });
  const [overlay, setOverlay] = useState<Overlay>({ kind: "none" });
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getToken());
  }, []);

  useEffect(() => {
    let mounted = true;

    async function showTaunt() {
      let taunt = "Você morreu. Que surpresa.";
      try {
        const res = await api.taunt(SLUG);
        taunt = res.taunt;
      } catch {
        /* backend offline: usa o padrão */
      }
      if (mounted) setOverlay({ kind: "death", taunt });
      // O overlay some sozinho — a cena já reinicia.
      setTimeout(() => mounted && setOverlay({ kind: "none" }), 1400);
    }

    async function start() {
      const { createGame } = await import("@/game/createGame");
      if (!mounted || !containerRef.current) return;

      gameRef.current = createGame(containerRef.current, {
        onDeath: (d) => {
          setDeaths(d);
          showTaunt();
        },
        onLevel: (index, total, name) => {
          setLevel({ index, total, name });
          setOverlay({ kind: "none" });
        },
        onWin: async ({ deaths, durationSeconds }) => {
          setOverlay({ kind: "win", deaths, seconds: durationSeconds });
          if (getToken()) {
            try {
              await api.submitRun(SLUG, {
                score: Math.max(0, 10000 - deaths * 100 - durationSeconds),
                deaths,
                duration_seconds: durationSeconds,
                completed: true,
              });
            } catch {
              /* sem login ou backend offline */
            }
          }
        },
      });
    }

    start();

    return () => {
      mounted = false;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[900px] items-center justify-between text-sm">
        <span className="font-mono text-red-400">💀 Mortes: {deaths}</span>
        <span className="font-mono text-amber-400">
          🔥 Fase {level.index + 1}/{level.total}
        </span>
        <span className="text-slate-400">
          {loggedIn ? "Pontuação será salva" : "Faça login para entrar no ranking"}
        </span>
      </div>

      <div className="relative w-full max-w-[900px]">
        <div ref={containerRef} className="overflow-hidden rounded-lg border border-slate-700" />

        {overlay.kind === "death" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-lg bg-red-900/80 px-6 py-3 text-xl font-bold text-white shadow-lg">
              {overlay.taunt}
            </p>
          </div>
        )}

        {overlay.kind === "win" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
            <p className="text-3xl font-black text-green-400">VOCÊ CONSEGUIU!</p>
            <p className="text-slate-200">
              Só precisou morrer <b>{overlay.deaths}</b> vezes em {overlay.seconds}s.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-500"
            >
              Jogar de novo (por quê?)
            </button>
          </div>
        )}
      </div>

      <div className="max-w-[900px] text-center text-sm text-slate-400">
        <b>Controles:</b> ← → ou A/D para andar · ↑ / W / Espaço para pular · botões na tela no
        celular. São {level.total} fases, do aquecimento ao inferno — e as armadilhas mudam de lugar
        a cada tentativa. Decorar não vai te salvar. 🔥
      </div>
    </div>
  );
}
