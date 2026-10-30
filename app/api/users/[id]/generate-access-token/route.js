import { issueToken } from "@/lib/store";
import { json, guard, err, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req, ctx) {
  const { id } = await ctx.params;
  const g = await guard(req, "User.generateAccessToken");
  if (g.response) return g.response;
  const target = g.store.users.find((u) => u.id === id);
  if (!target) return err(404, "User not found.");
  // Invalidate existing tokens for that user, then issue a fresh one.
  for (const [tok, rec] of Object.entries(g.store.tokens)) if (rec.userId === id) delete g.store.tokens[tok];
  const token = issueToken(g.store, { userId: id });
  return jsonP({ data: { userId: id, accessToken: token } });
}
