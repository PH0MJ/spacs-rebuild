import { hydrate } from "@/lib/db";
import { getStore, issueToken, userWithPermissions } from "@/lib/store";
import { json, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

// Login page removed: the client calls this to obtain a ready demo session.
export async function POST() {
  await hydrate();
  const store = getStore();
  const user = store.users.find((u) => u.username === "admin") || store.users[0];
  const token = issueToken(store, { userId: user.id });
  return jsonP({ token, user: userWithPermissions(store, user) });
}
