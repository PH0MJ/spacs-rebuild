import { json, guard, parseBody, err, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const { id } = await ctx.params;
  const g = await guard(req, "Role.view");
  if (g.response) return g.response;
  const role = g.store.roles.find((r) => r.id === id);
  if (!role) return err(404, "Role not found.");
  return json({ data: role });
}

export async function PUT(req, ctx) {
  const { id } = await ctx.params;
  const g = await guard(req, "Role.update");
  if (g.response) return g.response;
  const role = g.store.roles.find((r) => r.id === id);
  if (!role) return err(404, "Role not found.");
  const body = await parseBody(req);
  if (body.name && body.name !== role.name && g.store.roles.some((r) => r.name === body.name)) {
    return err(422, "The given data was invalid.", { name: ["The name has already been taken."] });
  }
  if (body.name !== undefined) role.name = body.name;
  if (Array.isArray(body.permissions)) role.permissions = body.permissions;
  return jsonP({ data: role });
}

export async function DELETE(req, ctx) {
  const { id } = await ctx.params;
  const g = await guard(req, "Role.delete");
  if (g.response) return g.response;
  const idx = g.store.roles.findIndex((r) => r.id === id);
  if (idx === -1) return err(404, "Role not found.");
  g.store.roles.splice(idx, 1);
  return jsonP({ status: "deleted" });
}
