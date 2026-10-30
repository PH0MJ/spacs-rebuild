import { getStore, userWithPermissions, issueToken } from "@/lib/store";
import { json, err, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const store = getStore();
  const body = await parseBody(req);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const user = store.users.find((u) => u.username === username);
  if (!user || user.password !== password || !user.isActive) {
    return err(422, "These credentials do not match our records.", {
      username: ["These credentials do not match our records."],
    });
  }
  const token = issueToken(store, { userId: user.id });
  return json({ token, user: userWithPermissions(store, user) });
}
