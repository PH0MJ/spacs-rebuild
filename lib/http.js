// Client-side HTTP helper. Adds the Bearer token + X-Locale, mirrors the
// reverse-engineered axios behaviour (401 clears the session).
export const TOKEN_KEY = "auth-token";
export const USER_KEY = "auth-user";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setSessionTokens(token, user) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSessionTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export async function http(path, { method = "GET", body, form, locale = "en" } = {}) {
  const headers = { "X-Locale": locale, Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, { method, headers, body: payload, cache: "no-store" });
  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json().catch(() => null);
  else data = await res.text().catch(() => null);
  if (res.status === 401) {
    clearSessionTokens();
  }
  return { ok: res.ok, status: res.status, data };
}
