import { instancesForSeries } from "@/lib/dicom";
import { json, guard, err } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const { uid, series, inst } = await ctx.params;
  const g = await guard(req, "Study.view");
  if (g.response) return g.response;
  const study = g.store.studies.find((s) => s.studyInstanceUid === uid);
  if (!study) return err(404, "Study not found.");
  const instance = instancesForSeries(study, series).find((i) => i.sopInstanceUID === inst);
  if (!instance) return err(404, "Instance not found.");
  return json({ data: [instance] });
}
