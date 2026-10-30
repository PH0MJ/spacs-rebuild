import { json, guard, parseBody, err } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const { id } = await ctx.params;
  const g = guard(req, ["PrintTemplate.viewOwn", "PrintTemplate.viewAny"]);
  if (g.response) return g.response;
  const tpl = g.store.printTemplates.find((t) => t.id === id);
  if (!tpl) return err(404, "Print template not found.");
  return json({ data: tpl });
}

export async function POST(req, ctx) {
  const { id } = await ctx.params;
  const g = guard(req, ["PrintTemplate.updateOwn", "PrintTemplate.updateAny"]);
  if (g.response) return g.response;
  const tpl = g.store.printTemplates.find((t) => t.id === id);
  if (!tpl) return err(404, "Print template not found.");
  const body = await parseBody(req);
  if (body.name !== undefined) tpl.name = body.name;
  if (body.header !== undefined) tpl.header = body.header;
  if (body.footer !== undefined) tpl.footer = body.footer;
  if (body.includePortalQr !== undefined) tpl.includePortalQr = !!body.includePortalQr;
  if (body.isDefault !== undefined) tpl.isDefault = !!body.isDefault;
  if (body.userId !== undefined) tpl.userId = body.userId || null;
  return json({ data: tpl });
}

export async function DELETE(req, ctx) {
  const { id } = await ctx.params;
  const g = guard(req, ["PrintTemplate.deleteOwn", "PrintTemplate.deleteAny"]);
  if (g.response) return g.response;
  const idx = g.store.printTemplates.findIndex((t) => t.id === id);
  if (idx === -1) return err(404, "Print template not found.");
  g.store.printTemplates.splice(idx, 1);
  return json({ status: "deleted" });
}
