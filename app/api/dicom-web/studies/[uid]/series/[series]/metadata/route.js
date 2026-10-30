import { instancesForSeries } from "@/lib/dicom";
import { json, guard, err } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const { uid, series } = await ctx.params;
  const g = await guard(req, "Study.view");
  if (g.response) return g.response;
  const study = g.store.studies.find((s) => s.studyInstanceUid === uid);
  if (!study) return err(404, "Study not found.");
  const instances = instancesForSeries(study, series);
  if (!instances.length) return err(404, "Series not found.");
  return json({ data: instances });
}
