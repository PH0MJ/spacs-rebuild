import { json, guard } from "@/lib/api";

export const dynamic = "force-dynamic";

// Lightweight id/name list used by filters (print templates, study share…).
export async function GET(req) {
  const ctx = await guard(req, null);
  if (ctx.response) return ctx.response;
  const data = ctx.store.users.map((u) => ({ id: u.id, name: u.name, username: u.username }));
  return json({ data });
}
