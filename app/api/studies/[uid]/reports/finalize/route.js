import { getStore, ulid } from "@/lib/store";
import { json, guard, parseBody, err, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req, ctx) {
  const { uid } = await ctx.params;
  const g = await guard(req, ["Report.finalize"]);
  if (g.response) return g.response;
  const study = g.store.studies.find((s) => s.studyInstanceUid === uid);
  if (!study) return err(404, "Study not found.");
  if (!study.report) study.report = { id: ulid(), studyInstanceUid: uid, status: "draft", content: "", finalizedAt: null, author: { id: g.auth.user.id }, revisionsCount: 0 };
  const body = await parseBody(req);
  study.report.content = body.content || study.report.content;
  study.report.status = "final";
  study.report.finalizedAt = new Date().toISOString();
  g.store.reportRevisions[study.report.id] = g.store.reportRevisions[study.report.id] || [];
  g.store.reportRevisions[study.report.id].push({
    id: ulid(), reportId: study.report.id, content: study.report.content,
    reason: "Signed & finalized", createdAt: new Date().toISOString(), author: g.auth.user.name,
  });
  study.report.revisionsCount = g.store.reportRevisions[study.report.id].length;
  return jsonP({ data: study.report, share: study.report.studyShare || null });
}
