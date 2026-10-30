import { json, guard, err } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req, ctx) {
  const { id } = await ctx.params;
  const g = guard(req, "User.revokeAllTokens");
  if (g.response) return g.response;
  const target = g.store.users.find((u) => u.id === id);
  if (!target) return err(404, "User not found.");
  for (const [tok, rec] of Object.entries(g.store.tokens)) if (rec.userId === id) delete g.store.tokens[tok];
  return json({ status: "revoked" });
}
