"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, clearToken, getToken, setToken, LeaderboardEntry } from "@/lib/api";

const SLUG = "trap-adventure";

export default function Home() {
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    api.leaderboard(SLUG).then(setBoard).catch(() => setBoard([]));
    if (getToken()) {
      api
        .me()
        .then((p) => setUsername(p.username))
        .catch(() => clearToken());
    }
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-center text-5xl font-black tracking-tight">
          Plataforma <span className="text-red-500">Armadilha</span>
        </h1>
        <p className="mt-4 text-center text-lg text-slate-400">
          Um jogo de plataforma feito para te deixar furioso. Cada pixel é uma traição.
          Você vai morrer. Muito.
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            href="/play"
            className="rounded-lg bg-red-600 px-8 py-4 text-xl font-bold text-white shadow-lg transition hover:bg-red-500 active:scale-95"
          >
            JOGAR (você vai se arrepender)
          </Link>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <Leaderboard board={board} />
          <AuthBox username={username} onChange={setUsername} />
        </div>
      </div>
    </main>
  );
}

function Leaderboard({ board }: { board: LeaderboardEntry[] }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="mb-3 text-lg font-bold">🏆 Quem mais sofreu (e venceu)</h2>
      {board.length === 0 ? (
        <p className="text-sm text-slate-500">Ninguém conseguiu ainda. Seja o primeiro.</p>
      ) : (
        <ol className="space-y-1 text-sm">
          {board.map((e, i) => (
            <li key={e.player_id} className="flex justify-between border-b border-slate-800 py-1">
              <span>
                {i + 1}. {e.username}
              </span>
              <span className="text-slate-400">
                {e.best_score} pts · {e.total_deaths} 💀
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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  if (username) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-3 text-lg font-bold">Bem-vindo, {username}</h2>
        <p className="text-sm text-slate-400">Suas pontuações serão salvas no ranking.</p>
        <button
          onClick={() => {
            clearToken();
            onChange(null);
          }}
          className="mt-4 rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
        >
          Sair
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

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-3 flex gap-2 text-sm">
        <button
          onClick={() => setMode("login")}
          className={mode === "login" ? "font-bold text-white" : "text-slate-500"}
        >
          Entrar
        </button>
        <span className="text-slate-700">|</span>
        <button
          onClick={() => setMode("register")}
          className={mode === "register" ? "font-bold text-white" : "text-slate-500"}
        >
          Criar conta
        </button>
      </div>
      <form onSubmit={submit} className="space-y-2">
        {mode === "register" && (
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="usuário"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        )}
        <input
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="senha"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
        >
          {mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>
    </section>
  );
}
