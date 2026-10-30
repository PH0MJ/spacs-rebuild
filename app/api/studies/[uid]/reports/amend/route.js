import { getStore, ulid } from "@/lib/store";
import { json, guard, parseBody, err, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req, ctx) {
  const { uid } = await ctx.params;
  const g = await guard(req, ["Report.updateOwn", "Report.updateAny"]);
  if (g.response) return g.response;
  const study = g.store.studies.find((s) => s.studyInstanceUid === uid);
  if (!study || !study.report) return err(404, "Report not found.");
  const body = await parseBody(req);
  study.report.content = body.content || study.report.content;
  study.report.status = "amended";
  study.report.finalizedAt = new Date().toISOString();
  g.store.reportRevisions[study.report.id] = g.store.reportRevisions[study.report.id] || [];
  g.store.reportRevisions[study.report.id].push({
    id: ulid(), reportId: study.report.id, content: study.report.content,
    reason: body.revisionReason || "Amendment", createdAt: new Date().toISOString(), author: g.auth.user.name,
  });
  study.report.revisionsCount = g.store.reportRevisions[study.report.id].length;
  return jsonP({ data: study.report, share: study.report.studyShare || null });
}
