import { json, guard } from "@/lib/api";

export const dynamic = "force-dynamic";

// Lightweight id/name list used by filters (print templates, study share…).
export function GET(req) {
  const ctx = guard(req, null);
  if (ctx.response) return ctx.response;
  const data = ctx.store.users.map((u) => ({ id: u.id, name: u.name, username: u.username }));
  return json({ data });
}
