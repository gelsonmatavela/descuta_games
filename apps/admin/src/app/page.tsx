"use client";

import { useCallback, useEffect, useState } from "react";
import { api, clearToken, getToken, setToken, Game, Overview, Player } from "@/lib/api";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;
  return <Dashboard onLogout={() => { clearToken(); setAuthed(false); }} />;
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.login(email, password);
      if (!res.player.is_admin) {
        setError("essa conta não é administradora");
        return;
      }
      setToken(res.token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <form onSubmit={submit} className="w-80 space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-xl font-bold">Painel Admin</h1>
        <input
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="email" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="senha" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="w-full rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">
          Entrar
        </button>
      </form>
    </main>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [taunt, setTaunt] = useState("");

  const load = useCallback(() => {
    api.overview().then(setOverview).catch(() => onLogout());
    api.players().then(setPlayers).catch(() => {});
    api.games().then(setGames).catch(() => {});
  }, [onLogout]);

  useEffect(() => { load(); }, [load]);

  async function changeDifficulty(slug: string, difficulty: number) {
    await api.setDifficulty(slug, difficulty).catch(() => {});
    load();
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Painel — Rage</h1>
          <button onClick={onLogout} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm">
            Sair
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Stat label="Jogadores" value={overview?.players ?? 0} />
          <Stat label="Tentativas" value={overview?.runs ?? 0} />
          <Stat label="Mortes totais" value={overview?.total_deaths ?? 0} emoji="💀" />
        </div>

        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="mb-3 text-lg font-bold">Dificuldade dos jogos</h2>
          {games.map((g) => (
            <div key={g.id} className="flex items-center justify-between border-b border-slate-800 py-2">
              <span>{g.name} <span className="text-slate-500">({g.slug})</span></span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">nível {g.difficulty}</span>
                <input
                  type="range" min={1} max={10} value={g.difficulty}
                  onChange={(e) => changeDifficulty(g.slug, Number(e.target.value))}
                />
              </div>
            </div>
          ))}
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="nova frase zombeteira..." value={taunt}
              onChange={(e) => setTaunt(e.target.value)}
            />
            <button
              onClick={async () => { if (taunt.trim()) { await api.createTaunt(taunt.trim(), games[0]?.id); setTaunt(""); } }}
              className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900"
            >
              Adicionar
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="mb-3 text-lg font-bold">Jogadores ({players.length})</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="py-1">Usuário</th><th>Email</th><th>Admin</th></tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-t border-slate-800">
                  <td className="py-1">{p.username}</td>
                  <td className="text-slate-400">{p.email}</td>
                  <td>{p.is_admin ? "✓" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, emoji }: { label: string; value: number; emoji?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-3xl font-black">{emoji} {value.toLocaleString("pt-BR")}</p>
    </div>
  );
}
