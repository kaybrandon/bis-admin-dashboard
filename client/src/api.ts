const TOKEN_KEY = "bis.admin.token";

export type User = {
  id: string;
  name: string;
  email: string;
  role: "staff" | "admin";
  title?: string;
  department?: string;
  manager?: string;
  phoneMobile?: string;
  phoneWork?: string;
  ext?: string;
  initials: string;
  avatarColor: string;
  birthdayInWindow?: boolean;
  coveringFor?: string;
  notes?: string;
  where?: { status: string; label: string; workplace?: string; destination?: string };
  openPunch?: { dir: string; workplace: string; destination?: string; at: string };
  kudosWeek?: number;
  kudosMonth?: number;
  mentionsWeek?: number;
};

export function token() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string | null) {
  if (t) sessionStorage.setItem(TOKEN_KEY, t);
  else sessionStorage.removeItem(TOKEN_KEY);
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const t = token();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    setToken(null);
    if (!path.includes("/auth/login")) window.location.href = "/login";
    throw new Error("Signed out");
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.error || JSON.stringify(j);
    } catch { /* ignore */ }
    const err = new Error(msg) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/csv")) return (await res.text()) as T;
  return res.json();
}

export const login = (email: string, password: string) =>
  api<{ token: string; user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const me = () => api<User>("/api/auth/me");
export const logout = () => api("/api/auth/logout", { method: "POST" });
export const refresh = () => api<{ token: string }>("/api/auth/refresh", { method: "POST" });
