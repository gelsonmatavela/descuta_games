"use client";

import { useEffect, useRef, useState } from "react";
import {
  Crosshair,
  Heart,
  Maximize,
  Skull,
  Smartphone,
  Target,
  Swords,
  MousePointer,
  Move,
  RefreshCw,
} from "lucide-react";
import { api, getToken } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import type { WarGameApi, WarHud } from "@/game/WarGame";

const SLUG = "warfront";
const BEST_KEY = "warfront-best";

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
  | { kind: "gameover"; score: number; wave: number; kills: number; record: boolean; taunt: string };

export default function WarClient() {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<WarGameApi | null>(null);
  const bestRef = useRef(0);

  const [started, setStarted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [hud, setHud] = useState<WarHud>({
    hp: 100,
    ammo: 30,
    reloading: false,
    score: 0,
    wave: 0,
    enemiesLeft: 0,
    kills: 0,
  });
  const [best, setBest] = useState(0);
  const [waveFlash, setWaveFlash] = useState<number | null>(null);
  const [damaged, setDamaged] = useState(0);
  const [overlay, setOverlay] = useState<Overlay>({ kind: "none" });
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getToken());
    const saved = Number(localStorage.getItem(BEST_KEY) || 0);
    bestRef.current = saved;
    setBest(saved);
  }, []);

  useEffect(() => {
    if (!started) return;
    let mounted = true;
    let waveTimer: ReturnType<typeof setTimeout>;

    async function start() {
      const { createWarGame } = await import("@/game/WarGame");
      if (!mounted || !containerRef.current) return;
      const game = createWarGame(containerRef.current, {
        onHud: (h) => mounted && setHud(h),
        onDamage: () => mounted && setDamaged((d) => d + 1),
        onLock: (l) => mounted && setLocked(l),
        onWave: (w) => {
          if (!mounted) return;
          setWaveFlash(w);
          clearTimeout(waveTimer);
          waveTimer = setTimeout(() => mounted && setWaveFlash(null), 1600);
        },
        onGameOver: async ({ score, wave, kills, durationSeconds }) => {
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
          if (mounted) setOverlay({ kind: "gameover", score, wave, kills, record, taunt: "" });

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
      });
      gameRef.current = game;
      setIsTouch(game.isTouch);
      game.lock();
    }
    start();

    return () => {
      mounted = false;
      clearTimeout(waveTimer);
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, [started]);

  // Vinheta vermelha rápida ao levar tiro.
  const [showVignette, setShowVignette] = useState(false);
  useEffect(() => {
    if (damaged === 0) return;
    setShowVignette(true);
    const id = setTimeout(() => setShowVignette(false), 220);
    return () => clearTimeout(id);
  }, [damaged]);

  function restart() {
    setOverlay({ kind: "none" });
    gameRef.current?.restart();
    gameRef.current?.lock();
  }

  const playing = started && overlay.kind === "none";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[900px] items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-1.5 font-mono text-emerald-300">
          <Target className="h-4 w-4" />
          {t("runner_score")}: {hud.score}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-amber-300">
          <Swords className="h-4 w-4" />
          {t("war_wave")} {hud.wave} · {t("war_enemies")}: {hud.enemiesLeft}
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden text-slate-400 sm:inline">
            {loggedIn ? t("score_saved") : t("login_to_rank")}
          </span>
          <span className="hidden font-mono text-slate-400 sm:inline">
            {t("runner_best")}: {best}
          </span>
          <button
            onClick={() => enterLandscape(wrapRef.current)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-slate-200 transition hover:border-emerald-500 hover:text-white"
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

      <div ref={wrapRef} className="relative w-full max-w-[900px] select-none">
        <div
          ref={containerRef}
          className="aspect-video w-full overflow-hidden rounded-lg border border-slate-700 bg-[#1a2018]"
        />

        {/* Mira */}
        {playing && (locked || isTouch) && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Crosshair className="h-6 w-6 text-white/80 drop-shadow" strokeWidth={1.5} />
          </div>
        )}

        {/* Vinheta de dano */}
        {showVignette && (
          <div className="pointer-events-none absolute inset-0 rounded-lg bg-red-600/25 ring-8 ring-inset ring-red-600/40" />
        )}

        {/* HUD inferior: vida + munição */}
        {playing && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-3">
            <div className="w-44 max-w-[40%]">
              <span className="mb-1 flex items-center gap-1 text-xs font-bold text-red-300">
                <Heart className="h-3.5 w-3.5" /> {t("war_hp")} {hud.hp}
              </span>
              <div className="h-2.5 overflow-hidden rounded-full bg-black/50">
                <div
                  className={`h-full rounded-full transition-all ${hud.hp > 40 ? "bg-emerald-500" : "bg-red-500"}`}
                  style={{ width: `${hud.hp}%` }}
                />
              </div>
            </div>
            <div className="rounded-lg bg-black/50 px-3 py-1.5 font-mono text-lg font-bold text-amber-200">
              {hud.reloading ? t("war_reloading") : `${hud.ammo}/30`}
            </div>
          </div>
        )}

        {/* Anúncio de onda */}
        {playing && waveFlash !== null && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center pt-20">
            <p className="text-4xl font-black tracking-widest text-emerald-300 drop-shadow-lg">
              {t("war_wave_n", { n: waveFlash })}
            </p>
          </div>
        )}

        {/* Botões de toque (mobile) */}
        {playing && isTouch && (
          <>
            <button
              onPointerDown={() => gameRef.current?.setFiring(true)}
              onPointerUp={() => gameRef.current?.setFiring(false)}
              onPointerLeave={() => gameRef.current?.setFiring(false)}
              className="absolute bottom-16 right-4 grid h-20 w-20 place-items-center rounded-full border-2 border-red-400/60 bg-red-500/30 text-sm font-black text-red-100 backdrop-blur active:bg-red-500/60"
            >
              {t("war_fire")}
            </button>
            <button
              onPointerDown={() => gameRef.current?.reload()}
              className="absolute bottom-40 right-7 grid h-12 w-12 place-items-center rounded-full border border-amber-400/50 bg-amber-500/20 text-amber-100 backdrop-blur active:bg-amber-500/50"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Tela inicial / tutorial */}
        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg bg-black/85 px-6 text-center">
            <h2 className="text-2xl font-black text-emerald-300">{t("tut_title")}</h2>
            <p className="max-w-md text-sm text-slate-300">{t("war_goal")}</p>
            <ul className="space-y-2 text-left text-sm text-slate-200">
              <li className="flex items-center gap-2">
                <Move className="h-4 w-4 text-emerald-300" /> {t("war_tut_move")}
              </li>
              <li className="flex items-center gap-2">
                <MousePointer className="h-4 w-4 text-emerald-300" /> {t("war_tut_aim")}
              </li>
              <li className="flex items-center gap-2">
                <Target className="h-4 w-4 text-red-400" /> {t("war_tut_shoot")}
              </li>
              <li className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-amber-300" /> {t("war_tut_reload")}
              </li>
            </ul>
            <button
              onClick={() => setStarted(true)}
              className="mt-1 rounded-lg bg-gradient-to-r from-emerald-400 to-green-500 px-6 py-2.5 font-bold text-black transition hover:opacity-90 active:scale-[0.98]"
            >
              {t("tut_start")}
            </button>
          </div>
        )}

        {/* Desktop sem pointer lock: clique para mirar */}
        {playing && !locked && !isTouch && (
          <button
            onClick={() => gameRef.current?.lock()}
            className="absolute inset-0 grid place-items-center rounded-lg bg-black/60 text-lg font-bold text-white"
          >
            <span className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3">
              <Crosshair className="h-5 w-5" />
              {t("war_click_aim")}
            </span>
          </button>
        )}

        {/* Game over */}
        {overlay.kind === "gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-black/80 px-4 text-center">
            <Skull className="h-10 w-10 text-red-400" />
            <p className="text-3xl font-black text-red-400">{t("war_gameover")}</p>
            {overlay.record && <p className="text-sm font-bold text-amber-300">{t("runner_new_record")}</p>}
            <p className="text-slate-200">
              {t("runner_score")}: <b>{overlay.score}</b> · {t("war_wave")} <b>{overlay.wave}</b> ·{" "}
              {t("war_kills")}: <b>{overlay.kills}</b>
            </p>
            {overlay.taunt && <p className="max-w-sm text-sm text-slate-400">{overlay.taunt}</p>}
            <button
              onClick={restart}
              className="mt-1 rounded-lg bg-gradient-to-r from-emerald-400 to-green-500 px-5 py-2 font-bold text-black transition hover:opacity-90 active:scale-[0.98]"
            >
              {t("play_again")}
            </button>
          </div>
        )}
      </div>

      <div className="max-w-[900px] text-center text-sm text-slate-400">
        <b>{t("controls_label")}</b>
        {t("war_controls")}
      </div>
    </div>
  );
}
