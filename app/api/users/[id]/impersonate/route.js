import { issueToken, userWithPermissions } from "@/lib/store";
import { json, guard, err } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req, ctx) {
  const { id } = await ctx.params;
  const g = guard(req, "User.impersonate");
  if (g.response) return g.response;
  const target = g.store.users.find((u) => u.id === id);
  if (!target) return err(404, "User not found.");
  const token = issueToken(g.store, { userId: target.id });
  return json({ token, user: userWithPermissions(g.store, target) });
}
