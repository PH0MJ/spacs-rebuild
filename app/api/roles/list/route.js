import { json, guard } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const ctx = await guard(req, null);
  if (ctx.response) return ctx.response;
  return json({ data: ctx.store.roles.map((r) => ({ id: r.id, name: r.name })) });
}
