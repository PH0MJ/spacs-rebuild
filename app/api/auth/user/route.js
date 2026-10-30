import { json, requireAuth } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const ctx = await requireAuth(req);
  if (ctx.response) return ctx.response;
  const user = ctx.auth.user;
  if (!user) return json({ data: null });
  return json({ data: user });
}
