import { json, guard } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const { reportId } = await ctx.params;
  const g = guard(req, "Report.view");
  if (g.response) return g.response;
  const revisions = g.store.reportRevisions[reportId] || [];
  return json({ data: revisions });
}
