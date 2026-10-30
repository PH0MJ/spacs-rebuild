import { renderFrameSvg } from "@/lib/dicom";
import { guard, err } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const { uid, series, inst, frame } = await ctx.params;
  const g = guard(req, "Study.view");
  if (g.response) return g.response;
  const study = g.store.studies.find((s) => s.studyInstanceUid === uid);
  if (!study) return err(404, "Study not found.");
  const svg = renderFrameSvg(study, series, inst, parseInt(frame, 10) || 1);
  return new Response(svg, { status: 200, headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
}
