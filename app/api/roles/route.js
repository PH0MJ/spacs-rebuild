import { getStore, ulid } from "@/lib/store";
import { json, guard, paginate, parseBody, err, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const ctx = await guard(req, "Role.view");
  if (ctx.response) return ctx.response;
  const { store } = ctx;
  const u = new URL(req.url);
  const search = (u.searchParams.get("search") || "").toLowerCase().trim();
  let items = store.roles.map((r) => ({
    id: r.id, name: r.name, permissions: r.permissions,
    usersCount: store.users.filter((x) => x.roles.includes(r.name)).length,
    isSystem: !!r.isSystem,
  }));
  if (search) items = items.filter((r) => r.name.toLowerCase().includes(search));
  return json(paginate(items, req.url));
}

export async function POST(req) {
  const ctx = await guard(req, "Role.create");
  if (ctx.response) return ctx.response;
  const body = await parseBody(req);
  if (!body.name) return err(422, "The given data was invalid.", { name: ["The name field is required."] });
  if (ctx.store.roles.some((r) => r.name === body.name)) {
    return err(422, "The given data was invalid.", { name: ["The name has already been taken."] });
  }
  const role = { id: ulid(), name: body.name, permissions: Array.isArray(body.permissions) ? body.permissions : [], isSystem: false };
  ctx.store.roles.push(role);
  return jsonP({ data: role }, 201);
}
