import { json, guard, err } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const { uid } = await ctx.params;
  const g = guard(req, "Study.view");
  if (g.response) return g.response;
  const study = g.store.studies.find((s) => s.studyInstanceUid === uid);
  if (!study) return err(404, "Study not found.");
  const report = study.report || null;
  const share = report && report.studyShare ? report.studyShare : null;
  return json({ data: report, share });
}
