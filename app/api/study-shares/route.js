import { getStore, ulid } from "@/lib/store";
import { json, guard, parseBody, err, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const g = await guard(req, "StudyShare.create");
  if (g.response) return g.response;
  const body = await parseBody(req);
  const study = g.store.studies.find((s) => s.studyInstanceUid === body.studyInstanceUid);
  if (!study) return err(404, "Study not found.");
  const id = ulid();
  const origin = new URL(req.url).origin;
  const share = {
    id, studyInstanceUid: study.studyInstanceUid,
    expiresAt: body.expiresAt || null,
    shareLink: `${origin}/portal/${id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  g.store.studyShares.push(share);
  if (study.report) study.report.studyShare = share;
  return jsonP({ data: share }, 201);
}
