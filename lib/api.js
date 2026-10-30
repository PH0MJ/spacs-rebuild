import { after } from "next/server";
import { hydrate, durable, persist } from "./db";
import { getStore, authFromRequest, permissionsForRoles } from "./store";

export function json(data, status = 200) {
  // Safety net for stray mutations: make the store durable after the response.
  if (durable && !json.__scheduled) {
    json.__scheduled = true;
    after(async () => {
      json.__scheduled = false;
      try { await persist(); } catch { /* retried on next request */ }
    });
  }
  return Response.json(data, { status });
}

// For mutating handlers: persist BEFORE the response is delivered, so any
// subsequent request (on any instance) observes the write.
export async function jsonP(data, status = 200) {
  const res = Response.json(data, { status });
  if (durable) { try { await persist(); } catch { /* best effort */ } }
  return res;
}

export function err(status, message, errors = undefined) {
  const body = { message };
  if (errors) body.errors = errors;
  return Response.json(body, { status });
}

export function paginate(items, url) {
  const u = new URL(url);
  const page = Math.max(1, parseInt(u.searchParams.get("page") || "1", 10) || 1);
  const perPage = Math.max(1, parseInt(u.searchParams.get("per_page") || "10", 10) || 10);
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const data = items.slice((page - 1) * perPage, page * perPage);
  return {
    data,
    meta: {
      current_page: page, from, last_page: lastPage, per_page: perPage, to, total,
      path: u.origin + u.pathname,
      links: [],
    },
  };
}

// Returns { auth } or { response } when unauthenticated.
export async function requireAuth(req) {
  const store = await hydrate();
  const auth = authFromRequest(store, req);
  if (!auth) return { response: err(401, "Unauthenticated.") };
  return { store, auth };
}

export function can(auth, perm) {
  if (!auth) return false;
  if (Array.isArray(perm)) return perm.some((p) => auth.user.permissions.includes(p));
  return auth.user.permissions.includes(perm);
}

export async function guard(req, perm) {
  const ctx = await requireAuth(req);
  if (ctx.response) return ctx;
  if (perm && !can(ctx.auth, perm)) return { response: err(403, "This action is unauthorized.") };
  return ctx;
}

export function parseBody(req) {
  return req.json().catch(() => ({}));
}

export function humanizePermission(p) {
  return p.replace(/\./g, " ").replace(/([A-Z])/g, " $1").trim();
}

export { permissionsForRoles };
