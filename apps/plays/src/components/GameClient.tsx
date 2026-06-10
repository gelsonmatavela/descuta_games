"use client";

import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { Skull, Flame, Maximize, Smartphone, Gamepad2, Hand } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import type { ControlMode } from "@/game/TrapScene";

const SLUG = "trap-adventure";
const CONTROL_KEY = "rage-control-mode";

async function enterLandscape(el: HTMLElement | null) {
  if (!el) return;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    const orientation = screen.orientation as unknown as { lock?: (o: string) => Promise<void> };
    if (orientation?.lock) await orientation.lock("landscape");
  } catch {
    /* sem lock de orientação */
  }
}

type Overlay =
  | { kind: "none" }
  | { kind: "death"; taunt: string }
  | { kind: "win"; deaths: number; seconds: number };

export default function GameClient() {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [control, setControl] = useState<ControlMode | null>(null);
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
    if (!control) return;
    const mode: ControlMode = control;
    let mounted = true;

    async function showTaunt() {
      let taunt = tRef.current("death_default");
      try {
        const res = await api.taunt(SLUG);
        taunt = res.taunt;
      } catch {
        /* backend offline: usa o padrão */
      }
      if (mounted) setOverlay({ kind: "death", taunt });
      setTimeout(() => mounted && setOverlay({ kind: "none" }), 1400);
    }

    async function start() {
      const { createGame } = await import("@/game/createGame");
      if (!mounted || !containerRef.current) return;
      gameRef.current = createGame(
        containerRef.current,
        {
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
        },
        mode,
      );
    }
    start();

    return () => {
      mounted = false;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [control]);

  function choose(mode: ControlMode) {
    try {
      localStorage.setItem(CONTROL_KEY, mode);
    } catch {
      /* ignora */
    }
    setControl(mode);
  }

  const savedControl =
    typeof window !== "undefined" ? (localStorage.getItem(CONTROL_KEY) as ControlMode | null) : null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[900px] items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-1.5 font-mono text-red-400">
          <Skull className="h-4 w-4" />
          {t("deaths")}: {deaths}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-amber-400">
          <Flame className="h-4 w-4" />
          {t("stage")} {level.index + 1}/{level.total}
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden text-slate-400 sm:inline">
            {loggedIn ? t("score_saved") : t("login_to_rank")}
          </span>
          <button
            onClick={() => enterLandscape(containerRef.current)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-slate-200 transition hover:border-blue-500 hover:text-white"
          >
            <Maximize className="h-4 w-4" />
            {t("fullscreen")}
          </button>
        </div>
      </div>

      <div className="flex w-full max-w-[900px] items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 portrait:flex landscape:hidden md:hidden">
        <Smartphone className="h-4 w-4 rotate-90" />
        {t("rotate_hint_a")}
        <b>{t("fullscreen")}</b>
        {t("rotate_hint_b")}
      </div>

      <div className="relative w-full max-w-[900px]">
        <div ref={containerRef} className="min-h-[260px] overflow-hidden rounded-lg border border-slate-700" />

        {/* Tela inicial: tutorial + escolha de controle */}
        {!control && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg bg-black/85 px-6 text-center">
            <h2 className="text-2xl font-black text-amber-300">{t("tut_title")}</h2>
            <p className="max-w-md text-sm text-slate-300">{t("rage_goal")}</p>
            <p className="text-sm font-bold text-slate-100">{t("control_choose")}</p>
            <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
              <button
                onClick={() => choose("buttons")}
                className={`flex-1 rounded-xl border p-4 text-left transition hover:border-amber-400 ${
                  savedControl === "buttons" ? "border-amber-400 bg-amber-400/10" : "border-white/15 bg-white/5"
                }`}
              >
                <span className="flex items-center gap-2 font-bold">
                  <Gamepad2 className="h-5 w-5 text-amber-300" />
                  {t("control_buttons")}
                </span>
                <span className="mt-1 block text-xs text-slate-400">{t("control_buttons_desc")}</span>
              </button>
              <button
                onClick={() => choose("gestures")}
                className={`flex-1 rounded-xl border p-4 text-left transition hover:border-cyan-400 ${
                  savedControl === "gestures" ? "border-cyan-400 bg-cyan-400/10" : "border-white/15 bg-white/5"
                }`}
              >
                <span className="flex items-center gap-2 font-bold">
                  <Hand className="h-5 w-5 text-cyan-300" />
                  {t("control_gestures")}
                </span>
                <span className="mt-1 block text-xs text-slate-400">{t("control_gestures_desc")}</span>
              </button>
            </div>
          </div>
        )}

        {overlay.kind === "death" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-lg bg-red-900/80 px-6 py-3 text-xl font-bold text-white shadow-lg">
              {overlay.taunt}
            </p>
          </div>
        )}

        {overlay.kind === "win" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-4 text-center">
            <p className="text-3xl font-black text-green-400">{t("win_title")}</p>
            <p className="text-slate-200">
              {t("win_sub_a")}
              <b>{overlay.deaths}</b>
              {t("win_sub_b", { seconds: overlay.seconds })}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-500"
            >
              {t("play_again")}
            </button>
          </div>
        )}
      </div>

      <div className="max-w-[900px] text-center text-sm text-slate-400">
        <b>{t("controls_label")}</b>
        {t("controls_text", { n: level.total })}
      </div>
    </div>
  );
}
