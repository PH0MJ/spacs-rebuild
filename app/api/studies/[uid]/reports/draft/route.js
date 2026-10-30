import { getStore, ulid } from "@/lib/store";
import { json, guard, parseBody, err, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

function ensureReport(ctx, uid) {
  const study = ctx.store.studies.find((s) => s.studyInstanceUid === uid);
  if (!study) return { error: err(404, "Study not found.") };
  if (!study.report) {
    study.report = {
      id: ulid(), studyInstanceUid: uid, status: "draft",
      content: "", finalizedAt: null, author: { id: ctx.auth.user.id }, revisionsCount: 0,
    };
  }
  return { study, report: study.report };
}

export async function POST(req, ctx) {
  const { uid } = await ctx.params;
  const g = await guard(req, "Report.create");
  if (g.response) return g.response;
  const { error, study, report } = ensureReport(g, uid);
  if (error) return error;
  const body = await parseBody(req);
  report.content = body.content || "";
  report.status = "draft";
  return jsonP({ data: report, share: study.report.studyShare || null });
}
