import { json, guard, parseBody, err, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PUT(req, ctx) {
  const { id } = await ctx.params;
  const g = await guard(req, ["ReportTemplate.updateOwn", "ReportTemplate.updateAny"]);
  if (g.response) return g.response;
  const tpl = g.store.reportTemplates.find((t) => t.id === id);
  if (!tpl) return err(404, "Template not found.");
  const body = await parseBody(req);
  if (body.name !== undefined) tpl.name = body.name;
  if (body.content !== undefined) tpl.content = body.content;
  return jsonP({ data: tpl });
}

export async function DELETE(req, ctx) {
  const { id } = await ctx.params;
  const g = await guard(req, ["ReportTemplate.deleteOwn", "ReportTemplate.deleteAny"]);
  if (g.response) return g.response;
  const idx = g.store.reportTemplates.findIndex((t) => t.id === id);
  if (idx === -1) return err(404, "Template not found.");
  g.store.reportTemplates.splice(idx, 1);
  return jsonP({ status: "deleted" });
}
