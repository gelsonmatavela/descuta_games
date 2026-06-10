const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";
const TOKEN_KEY = "rage_admin_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface Player {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}
export interface Overview {
  players: number;
  runs: number;
  total_deaths: number;
}
export interface Game {
  id: string;
  slug: string;
  name: string;
  difficulty: number;
  active: boolean;
  created_at: string;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; player: Player }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  overview: () => request<Overview>("/admin/overview"),
  players: () => request<Player[]>("/admin/players"),
  games: () => request<Game[]>("/games"),
  setDifficulty: (slug: string, difficulty: number) =>
    request<Game>(`/admin/games/${slug}/difficulty`, {
      method: "PATCH",
      body: JSON.stringify({ difficulty }),
    }),
  createTaunt: (text: string, game_id?: string) =>
    request("/admin/taunts", {
      method: "POST",
      body: JSON.stringify({ text, game_id: game_id ?? null }),
    }),
};
