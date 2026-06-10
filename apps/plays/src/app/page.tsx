"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Gem,
  Flame,
  Rabbit,
  Puzzle,
  Target,
  Trophy,
  Crown,
  Medal,
  Lock,
  Play,
  Joystick,
  User,
  LogOut,
  Zap,
  Sparkles,
  ChevronRight,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api, clearToken, getToken, setToken, LeaderboardEntry } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import type { TKey } from "@/i18n/dictionaries";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const FEATURED_SLUG = "trap-adventure";

interface GameCard {
  slug: string;
  title?: string; // nome fixo (não traduz) — só para jogos reais
  tagKey: TKey;
  Icon: LucideIcon;
  accent: string;
  glow: string;
  status: "playable" | "soon";
  href?: string;
  badge?: { label: string; Icon: LucideIcon; className: string };
}

const GAMES: GameCard[] = [
  {
    slug: "trap-adventure",
    title: "Rage",
    tagKey: "tag_rage",
    Icon: Flame,
    accent: "from-orange-500 via-red-500 to-rose-600",
    glow: "hover:shadow-orange-500/30",
    status: "playable",
    href: "/play",
    badge: { label: "HOT", Icon: Zap, className: "bg-orange-500 text-white" },
  },
  {
    slug: "neon-dash",
    title: "Neon Dash",
    tagKey: "tag_runner",
    Icon: Rabbit,
    accent: "from-fuchsia-500 via-purple-500 to-indigo-600",
    glow: "hover:shadow-fuchsia-500/30",
    status: "playable",
    href: "/runner",
    badge: { label: "NEW", Icon: Sparkles, className: "bg-fuchsia-500 text-white" },
  },
  {
    slug: "soon-puzzle",
    tagKey: "tag_puzzle",
    Icon: Puzzle,
    accent: "from-cyan-400 via-sky-500 to-blue-600",
    glow: "",
    status: "soon",
  },
  {
    slug: "soon-shooter",
    tagKey: "tag_shooter",
    Icon: Target,
    accent: "from-emerald-400 via-teal-500 to-green-600",
    glow: "",
    status: "soon",
  },
];

export default function Home() {
  const { t } = useI18n();
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    api.leaderboard(FEATURED_SLUG).then(setBoard).catch(() => setBoard([]));
    if (getToken()) {
      api
        .me()
        .then((p) => setUsername(p.username))
        .catch(() => clearToken());
    }
  }, []);

  const playable = GAMES.filter((g) => g.status === "playable").length;

  return (
    <main className="bg-deep relative min-h-screen pb-24 md:pb-12">
      <div className="mx-auto max-w-6xl px-4">
        {/* ── Header ─────────────────────────────────────────── */}
        <header id="top" className="flex items-center justify-between py-5 scroll-mt-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Descuta Games"
              width={44}
              height={44}
              priority
              className="h-11 w-11 rounded-xl shadow-lg shadow-fuchsia-500/30"
            />
            <span className="text-lg font-black tracking-tight">
              DESCUTA <span className="text-gradient">GAMES</span>
            </span>
          </Link>

          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />
            {username ? (
              <div className="glass flex items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <User className="h-4 w-4 text-blue-300" />
                  {username}
                </span>
                <button
                  onClick={() => {
                    clearToken();
                    setUsername(null);
                  }}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-slate-300 transition hover:bg-red-500/20 hover:text-red-300"
                  aria-label={t("logout")}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <a
                href="#conta"
                className="rounded-full bg-gradient-to-r from-blue-500 to-fuchsia-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:opacity-90"
              >
                {t("login")}
              </a>
            )}
          </div>
        </header>

        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="glass relative mt-2 overflow-hidden rounded-3xl p-8 sm:p-12">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="absolute -bottom-12 left-1/3 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative">
            <h1 className="mt-5 max-w-2xl text-5xl font-black leading-[1.02] tracking-tighter sm:text-6xl">
              {t("hero_title_a")}
              <span className="text-gradient">{t("hero_highlight")}</span>
              {t("hero_title_b")}
            </h1>
            <p className="mt-4 max-w-lg text-base text-slate-400">{t("hero_subtitle")}</p>
            <a
              href="#jogos"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 px-6 py-3 text-sm font-bold text-black shadow-lg shadow-emerald-500/25 transition hover:opacity-90 active:scale-[0.98]"
            >
              <Play className="h-4 w-4 fill-black" />
              {t("hero_cta")}
            </a>
          </div>
        </section>

        {/* ── Stats ──────────────────────────────────────────── */}
        <section className="mt-5 grid grid-cols-3 gap-3">
          <StatPill Icon={Joystick} value={String(GAMES.length)} label={t("stat_games")} tint="text-blue-300" />
          <StatPill Icon={Users} value={String(board.length)} label={t("stat_ranked")} tint="text-fuchsia-300" />
          <StatPill Icon={Gem} value="∞" label={t("stat_points")} tint="text-cyan-300" />
        </section>

        {/* ── Catálogo ───────────────────────────────────────── */}
        <section id="jogos" className="mt-12 scroll-mt-6">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight">
              <Joystick className="h-6 w-6 text-blue-400" />
              {t("games_title")}
            </h2>
            <span className="flex items-center gap-1 text-sm text-slate-500">
              {t("see_ranking")} <ChevronRight className="h-4 w-4" />
            </span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {GAMES.map((game) => (
              <GameTile key={game.slug} game={game} />
            ))}
          </div>
        </section>

        {/* ── Ranking + Conta ────────────────────────────────── */}
        <section id="conta" className="mt-12 grid scroll-mt-6 gap-5 md:grid-cols-2">
          <Leaderboard board={board} />
          <AuthBox username={username} onChange={setUsername} />
        </section>

        <footer className="mt-12 border-t border-white/5 pt-6 text-center text-xs text-slate-500">
          <p>{t("footer_tagline")}</p>
          <p className="mt-1">
            {t("powered_by")}{" "}
            <a
              href="https://gelsonmatavela.site"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-300 transition hover:text-fuchsia-300"
            >
              Gelson Matavela
            </a>
          </p>
        </footer>
      </div>

      {/* ── Bottom nav (mobile) ──────────────────────────────── */}
      <nav className="glass fixed inset-x-0 bottom-0 z-20 flex items-center justify-around rounded-t-2xl px-2 py-2.5 md:hidden">
        <NavItem href="#top" Icon={Joystick} label={t("nav_home")} />
        <NavItem href="#jogos" Icon={Flame} label={t("nav_games")} />
        <NavItem href="#conta" Icon={Trophy} label={t("nav_ranking")} />
        <NavItem href="#conta" Icon={User} label={t("nav_account")} />
      </nav>
    </main>
  );
}

function StatPill({
  Icon,
  value,
  label,
  tint,
}: {
  Icon: LucideIcon;
  value: string;
  label: string;
  tint: string;
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
      <Icon className={`h-5 w-5 shrink-0 ${tint}`} />
      <div className="min-w-0">
        <p className="text-lg font-black leading-none">{value}</p>
        <p className="truncate text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function GameTile({ game }: { game: GameCard }) {
  const { t } = useI18n();
  const title = game.status === "soon" ? t("coming_soon") : game.title;
  const tagline = t(game.tagKey);

  const cover = (
    <div className={`relative grid h-36 place-items-center bg-gradient-to-br ${game.accent}`}>
      <game.Icon className="h-16 w-16 text-white/90 drop-shadow-lg" strokeWidth={1.5} />
      {game.badge && (
        <span
          className={`absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${game.badge.className}`}
        >
          <game.badge.Icon className="h-3 w-3" />
          {game.badge.label}
        </span>
      )}
      {game.status === "soon" && (
        <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur">
          <Lock className="h-3 w-3" />
          {t("coming_soon")}
        </span>
      )}
    </div>
  );

  if (game.status === "playable" && game.href) {
    return (
      <Link
        href={game.href}
        className={`glass group overflow-hidden rounded-2xl transition duration-200 hover:-translate-y-1 hover:shadow-xl ${game.glow}`}
      >
        {cover}
        <div className="flex items-center justify-between p-4">
          <div className="min-w-0">
            <h3 className="truncate font-bold">{title}</h3>
            <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">{tagline}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-400 to-green-500 px-3 py-1.5 text-sm font-bold text-black transition group-hover:opacity-90">
            <Play className="h-3.5 w-3.5 fill-black" />
            {t("play")}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <div className="glass cursor-not-allowed overflow-hidden rounded-2xl opacity-60">
      <div className="grayscale-[0.35]">{cover}</div>
      <div className="p-4">
        <h3 className="font-bold">{title}</h3>
        <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">{tagline}</p>
      </div>
    </div>
  );
}

function Leaderboard({ board }: { board: LeaderboardEntry[] }) {
  const { t } = useI18n();
  const rankStyle = (i: number) =>
    i === 0
      ? "bg-amber-400 text-black"
      : i === 1
        ? "bg-slate-300 text-black"
        : i === 2
          ? "bg-orange-700 text-white"
          : "bg-white/10 text-slate-400";

  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
        <Trophy className="h-5 w-5 text-amber-400" />
        {t("lb_title")}
      </h2>
      {board.length === 0 ? (
        <p className="text-sm text-slate-500">{t("lb_empty")}</p>
      ) : (
        <ol className="space-y-1.5 text-sm">
          {board.map((e, i) => (
            <li
              key={e.player_id}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-white/5"
            >
              <span className="flex items-center gap-2.5">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-md text-xs font-black ${rankStyle(i)}`}
                >
                  {i === 0 ? <Crown className="h-3.5 w-3.5" /> : i === 1 || i === 2 ? <Medal className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <b>{e.username}</b>
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                {e.best_score} {t("lb_pts")}
                <span className="text-slate-600">·</span>
                {e.total_deaths} {t("lb_deaths")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function AuthBox({
  username,
  onChange,
}: {
  username: string | null;
  onChange: (u: string | null) => void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  if (username) {
    return (
      <section className="glass rounded-2xl p-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-black">
          <Sparkles className="h-5 w-5 text-fuchsia-400" />
          {t("welcome")}
          <span className="text-gradient">{username}</span>
        </h2>
        <p className="text-sm text-slate-400">{t("account_note")}</p>
        <button
          onClick={() => {
            clearToken();
            onChange(null);
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:border-red-500/50 hover:text-red-300"
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </button>
      </section>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res =
        mode === "login"
          ? await api.login(form.email, form.password)
          : await api.register(form.username, form.email, form.password);
      setToken(res.token);
      onChange(res.player.username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro");
    }
  }

  const inputCls =
    "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500";

  return (
    <section className="glass rounded-2xl p-6">
      <div className="mb-4 flex gap-1 rounded-lg bg-black/30 p-1 text-sm">
        <button
          onClick={() => setMode("login")}
          className={`flex-1 rounded-md py-1.5 font-semibold transition ${
            mode === "login" ? "bg-gradient-to-r from-blue-500 to-fuchsia-500 text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          {t("tab_login")}
        </button>
        <button
          onClick={() => setMode("register")}
          className={`flex-1 rounded-md py-1.5 font-semibold transition ${
            mode === "register" ? "bg-gradient-to-r from-blue-500 to-fuchsia-500 text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          {t("tab_register")}
        </button>
      </div>
      <form onSubmit={submit} className="space-y-2.5">
        {mode === "register" && (
          <input
            className={inputCls}
            placeholder={t("ph_username")}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        )}
        <input
          className={inputCls}
          placeholder={t("ph_email")}
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder={t("ph_password")}
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-gradient-to-r from-emerald-400 to-green-500 px-3 py-2.5 text-sm font-bold text-black transition hover:opacity-90 active:scale-[0.98]"
        >
          {mode === "login" ? t("btn_login") : t("btn_register")}
        </button>
      </form>
    </section>
  );
}

function NavItem({ href, Icon, label }: { href: string; Icon: LucideIcon; label: string }) {
  return (
    <a href={href} className="flex flex-col items-center gap-1 px-3 py-1 text-slate-400 transition hover:text-white">
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-semibold">{label}</span>
    </a>
  );
}
