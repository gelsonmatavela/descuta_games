const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

const TOKEN_KEY = "rage_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
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

export interface AuthResponse {
  token: string;
  player: Player;
}

export interface LeaderboardEntry {
  player_id: string;
  username: string;
  best_score: number;
  total_deaths: number;
  runs: number;
}

export interface RageStats {
  total_runs: number;
  total_deaths: number;
  best_score: number | null;
  longest_run_seconds: number | null;
  completed_runs: number;
}

export const api = {
  register: (username: string, email: string, password: string) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<Player>("/auth/me"),

  submitRun: (
    slug: string,
    run: { score: number; deaths: number; duration_seconds: number; completed: boolean },
  ) =>
    request(`/scores/${slug}/runs`, {
      method: "POST",
      body: JSON.stringify(run),
    }),

  leaderboard: (slug: string, limit = 20) =>
    request<LeaderboardEntry[]>(`/scores/${slug}/leaderboard?limit=${limit}`),

  myStats: (slug: string) => request<RageStats>(`/stats/${slug}/me`),

  taunt: (slug: string) => request<{ taunt: string }>(`/stats/${slug}/taunt`),
};
