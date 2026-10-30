import { userWithPermissions } from "@/lib/store";
import { json, guard, parseBody, err } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const { id } = await ctx.params;
  const g = guard(req, "User.view");
  if (g.response) return g.response;
  const user = g.store.users.find((u) => u.id === id);
  if (!user) return err(404, "User not found.");
  return json({ data: userWithPermissions(g.store, user) });
}

export async function PUT(req, ctx) {
  const { id } = await ctx.params;
  const g = guard(req, "User.update");
  if (g.response) return g.response;
  const { store } = g;
  const user = store.users.find((u) => u.id === id);
  if (!user) return err(404, "User not found.");
  const body = await parseBody(req);
  const errors = {};
  if (body.username && body.username !== user.username && store.users.some((x) => x.username === body.username)) {
    errors.username = ["The username has already been taken."];
  }
  if (body.password && body.password !== body.password_confirmation) {
    errors.password = ["The password confirmation does not match."];
  }
  if (Object.keys(errors).length) return err(422, "The given data was invalid.", errors);

  if (body.name !== undefined) user.name = body.name;
  if (body.speciality !== undefined) user.speciality = body.speciality;
  if (body.username !== undefined) user.username = body.username;
  if (body.isActive !== undefined) user.isActive = !!body.isActive;
  if (Array.isArray(body.roles)) user.roles = body.roles;
  if (body.password) user.password = body.password;
  return json({ data: userWithPermissions(store, user) });
}
