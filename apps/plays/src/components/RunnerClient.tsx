"use client";

import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { Gem, Trophy, Maximize, Smartphone, Shield, Hand, Carrot, Rocket } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import type { RunnerCallbacks } from "@/game/RunnerScene";

const SLUG = "neon-dash";
const BEST_KEY = "neon-dash-best";
const TUTORIAL_KEY = "neon-dash-tutorial-seen";

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
  | { kind: "gameover"; score: number; seconds: number; record: boolean; taunt: string };

export default function RunnerClient() {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const cbRef = useRef<RunnerCallbacks | null>(null);
  const bestRef = useRef(0);

  const [started, setStarted] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [shieldLeft, setShieldLeft] = useState(0);
  const [overlay, setOverlay] = useState<Overlay>({ kind: "none" });
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getToken());
    const saved = Number(localStorage.getItem(BEST_KEY) || 0);
    bestRef.current = saved;
    setBest(saved);
    if (localStorage.getItem(TUTORIAL_KEY)) setStarted(true);
    else setShowTutorial(true);
  }, []);

  useEffect(() => {
    if (!started) return;
    let mounted = true;

    const callbacks: RunnerCallbacks = {
      onScore: (s) => setScore(s),
      onShield: (secs) => setShieldLeft(secs),
      onGameOver: async ({ score, durationSeconds }) => {
        const record = score > bestRef.current;
        if (record) {
          bestRef.current = score;
          setBest(score);
          try {
            localStorage.setItem(BEST_KEY, String(score));
          } catch {
            /* ignora */
          }
        }
        setOverlay({ kind: "gameover", score, seconds: durationSeconds, record, taunt: "" });

        if (getToken()) {
          try {
            await api.submitRun(SLUG, {
              score,
              deaths: 1,
              duration_seconds: durationSeconds,
              completed: false,
            });
          } catch {
            /* offline ou sem login */
          }
        }

        let taunt = tRef.current("death_default");
        try {
          const res = await api.taunt(SLUG);
          taunt = res.taunt;
        } catch {
          /* padrão */
        }
        if (mounted) setOverlay((o) => (o.kind === "gameover" ? { ...o, taunt } : o));
      },
    };
    cbRef.current = callbacks;

    async function start() {
      const { createRunnerGame } = await import("@/game/createRunnerGame");
      if (!mounted || !containerRef.current) return;
      gameRef.current = createRunnerGame(containerRef.current, callbacks);
    }
    start();

    return () => {
      mounted = false;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [started]);

  function beginGame() {
    try {
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      /* ignora */
    }
    setShowTutorial(false);
    setStarted(true);
  }

  function restart() {
    setScore(0);
    setShieldLeft(0);
    setOverlay({ kind: "none" });
    const scene = gameRef.current?.scene.getScene("RunnerScene");
    if (scene && cbRef.current) scene.scene.restart({ callbacks: cbRef.current });
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[900px] items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-1.5 font-mono text-cyan-300">
          <Gem className="h-4 w-4" />
          {t("runner_score")}: {score}
        </span>
        {shieldLeft > 0 ? (
          <span className="flex items-center gap-1.5 font-mono font-bold text-cyan-300">
            <Shield className="h-4 w-4" />
            {t("runner_shield")} {shieldLeft}s
          </span>
        ) : (
          <span className="flex items-center gap-1.5 font-mono text-amber-300">
            <Trophy className="h-4 w-4" />
            {t("runner_best")}: {best}
          </span>
        )}
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

        {showTutorial && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg bg-black/85 px-6 text-center">
            <h2 className="text-2xl font-black text-cyan-300">{t("tut_title")}</h2>
            <ul className="space-y-2 text-left text-sm text-slate-200">
              <li className="flex items-center gap-2"><Hand className="h-4 w-4 text-cyan-300" /> {t("tut_tap")}</li>
              <li className="flex items-center gap-2"><Hand className="h-4 w-4 text-cyan-300" /> {t("tut_double")}</li>
              <li className="flex items-center gap-2"><Carrot className="h-4 w-4 text-orange-400" /> {t("tut_carrot")}</li>
              <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-amber-300" /> {t("tut_magic")}</li>
              <li className="flex items-center gap-2"><Rocket className="h-4 w-4 text-rose-400" /> {t("tut_ships")}</li>
            </ul>
            <button
              onClick={beginGame}
              className="mt-1 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-2.5 font-bold text-black transition hover:opacity-90 active:scale-[0.98]"
            >
              {t("tut_start")}
            </button>
          </div>
        )}

        {overlay.kind === "gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-4 text-center">
            <p className="text-3xl font-black text-rose-400">{t("runner_gameover")}</p>
            {overlay.record && <p className="text-sm font-bold text-amber-300">{t("runner_new_record")}</p>}
            <p className="text-slate-200">
              {t("runner_score")}: <b>{overlay.score}</b>
            </p>
            {overlay.taunt && <p className="max-w-sm text-sm text-slate-400">{overlay.taunt}</p>}
            <button
              onClick={restart}
              className="mt-1 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-2 font-bold text-black transition hover:opacity-90 active:scale-[0.98]"
            >
              {t("play_again")}
            </button>
          </div>
        )}
      </div>

      <div className="max-w-[900px] text-center text-sm text-slate-400">
        <b>{t("controls_label")}</b>
        {t("runner_controls")}
      </div>
    </div>
  );
}
