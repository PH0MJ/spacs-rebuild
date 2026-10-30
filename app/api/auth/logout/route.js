import { json, requireAuth } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const ctx = requireAuth(req);
  if (ctx.response) return ctx.response;
  delete ctx.store.tokens[ctx.auth.token];
  return json({ status: "logged" });
}
