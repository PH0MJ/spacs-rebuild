import { getStore, CONSTANTS } from "@/lib/store";
import { json, guard } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const ctx = await guard(req, null);
  if (ctx.response) return ctx.response;
  // Full permission universe for the Role matrix.
  const store = getStore();
  const all = new Set(CONSTANTS.PERMISSIONS);
  for (const r of store.roles) r.permissions.forEach((p) => all.add(p));
  return json([...all].sort());
}
