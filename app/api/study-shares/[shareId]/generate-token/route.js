import { hydrate } from "@/lib/db";
import { getStore, issueToken, userWithPermissions } from "@/lib/store";
import { json, err, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

// Public: exchanges a share id for a scoped guest session.
export async function POST(req, ctx) {
  const { shareId } = await ctx.params;
  await hydrate();
  const store = getStore();
  const share = store.studyShares.find((s) => s.id === shareId);
  if (!share) return err(404, "This share link is not valid or has been revoked.");
  if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
    return err(410, "This share link has expired.");
  }
  const token = issueToken(store, { isGuest: true, studyInstanceUid: share.studyInstanceUid });
  const guest = {
    id: "guest", name: "Guest", speciality: "Patient Portal", username: "guest",
    isActive: true, roles: ["guest"], permissions: ["Study.view"],
    preference: { modalities: [], autoRefreshPeriod: 0, navigationLayout: "compact", defaultHomePage: "/studies" },
  };
  return jsonP({ token, user: guest, studyInstanceUid: share.studyInstanceUid });
}
