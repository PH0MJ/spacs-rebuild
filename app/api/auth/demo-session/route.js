import { getStore, issueToken, userWithPermissions } from "@/lib/store";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

// Login page removed: the client calls this to obtain a ready demo session.
export async function POST() {
  const store = getStore();
  const user = store.users.find((u) => u.username === "admin") || store.users[0];
  const token = issueToken(store, { userId: user.id });
  return json({ token, user: userWithPermissions(store, user) });
}
