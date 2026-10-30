import { json, requireAuth, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const ctx = await requireAuth(req);
  if (ctx.response) return ctx.response;
  delete ctx.store.tokens[ctx.auth.token];
  return jsonP({ status: "logged" });
}
