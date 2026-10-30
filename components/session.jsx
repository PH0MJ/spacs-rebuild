"use client";
import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { http, setSessionTokens, clearSessionTokens, getToken, USER_KEY } from "@/lib/http";
import { Icon } from "./icons";

const SessionCtx = createContext(null);

export function useSession() {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

let toastSeq = 0;

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(null);
  const [ready, setReady] = useState(false);
  const [locale, setLocale] = useState("en");
  const [theme, setTheme] = useState("dark");
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const confirmResolver = useRef(null);

  // --- theme ---
  useEffect(() => {
    const stored = window.localStorage.getItem("theme-preference");
    const initial = stored === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
    const storedLocale = window.localStorage.getItem("locale-preference");
    if (storedLocale) setLocale(storedLocale);
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      window.localStorage.setItem("theme-preference", next);
      return next;
    });
  }, []);

  // --- toasts ---
  const pushToast = useCallback((variant, description, title) => {
    const id = ++toastSeq;
    setToasts((list) => [...list, { id, variant, description, title }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4200);
  }, []);
  const toast = {
    show: (v) => pushToast(v.variant || "info", v.description, v.title),
    success: (d, t) => pushToast("success", d, t),
    info: (d, t) => pushToast("info", d, t),
    warning: (d, t) => pushToast("warning", d, t),
    danger: (d, t) => pushToast("danger", d, t),
    operationSuccessful: () => pushToast("success", "Operation done successfully.", "Success"),
  };

  // --- confirm ---
  const confirm = useCallback((opts = {}) => {
    setConfirmState({ title: "Are you sure?", message: "", confirmText: "Confirm", cancelText: "Cancel", variant: "brand", ...opts });
    return new Promise((resolve) => { confirmResolver.current = resolve; });
  }, []);
  const finishConfirm = (value) => {
    setConfirmState(null);
    if (confirmResolver.current) { confirmResolver.current(value); confirmResolver.current = null; }
  };

  // --- api helper (adds locale) ---
  const api = useCallback((path, opts = {}) => http(path, { ...opts, locale }), [locale]);

  // --- bootstrap session (login page removed) ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let tok = getToken();
        if (tok) {
          const res = await http("/auth/user", { locale });
          if (res.ok && res.data?.data) {
            if (!cancelled) { setUser(res.data.data); setTokenState(tok); setReady(true); return; }
          } else {
            clearSessionTokens();
            tok = null;
          }
        }
        if (!tok) {
          const res = await http("/auth/demo-session", { method: "POST", locale });
          if (res.ok) {
            setSessionTokens(res.data.token, res.data.user);
            if (!cancelled) { setUser(res.data.user); setTokenState(res.data.token); }
          } else {
            toast.danger("Could not establish a demo session.");
          }
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api("/auth/login", { method: "POST", body: { username, password, device_name: "demo-device" } });
    if (res.ok) { setSessionTokens(res.data.token, res.data.user); setUser(res.data.user); setTokenState(res.data.token); return { success: true, user: res.data.user }; }
    return { success: false, error: res.data?.message || "Invalid credentials." };
  }, [api]);

  const logout = useCallback(async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch {}
    clearSessionTokens();
    setUser(null); setTokenState(null);
  }, [api]);

  const impersonate = useCallback(async (id) => {
    const res = await api(`/users/${id}/impersonate`, { method: "POST" });
    if (res.ok) { setSessionTokens(res.data.token, res.data.user); setUser(res.data.user); setTokenState(res.data.token); return { success: true, user: res.data.user }; }
    return { success: false, error: res.data?.message || "Impersonation failed." };
  }, [api]);

  const hasPermission = useCallback((p) => {
    if (!user) return false;
    if (Array.isArray(p)) return p.some((x) => user.permissions?.includes(x));
    return user.permissions?.includes(p) ?? false;
  }, [user]);

  const updateUser = useCallback((u) => { setUser(u); }, []);
  const setSession = useCallback((tok, u) => { setSessionTokens(tok, u); setTokenState(tok); setUser(u); }, []);

  const value = {
    user, token, ready, api, locale, setLocale, theme, toggleTheme,
    toast, confirm, hasPermission, login, logout, impersonate, updateUser, setSession,
  };

  return (
    <SessionCtx.Provider value={value}>
      {children}
      <div className="toast-host">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.variant}`}>
            {t.title ? <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{t.title}</div> : null}
            <div>{t.description}</div>
          </div>
        ))}
      </div>
      {confirmState ? (
        <div className="overlay" onClick={() => finishConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="h2">{confirmState.title}</div>
            <p className="muted small" style={{ marginTop: 8 }}>{confirmState.message}</p>
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn" onClick={() => finishConfirm(false)}>{confirmState.cancelText}</button>
              <button className={`btn ${confirmState.variant === "danger" ? "danger" : "primary"}`} onClick={() => finishConfirm(true)}>{confirmState.confirmText}</button>
            </div>
          </div>
        </div>
      ) : null}
    </SessionCtx.Provider>
  );
}
