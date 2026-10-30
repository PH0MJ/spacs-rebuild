import { getStore, ulid, CONSTANTS, userWithPermissions } from "@/lib/store";
import { json, guard, can, paginate, parseBody, err, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const ctx = await guard(req, "User.view");
  if (ctx.response) return ctx.response;
  const { store } = ctx;
  const u = new URL(req.url);
  const search = (u.searchParams.get("search") || "").toLowerCase().trim();
  const status = u.searchParams.get("status") || "";
  let items = store.users.map((usr) => ({ ...userWithPermissions(store, usr), accessToken: null }));
  if (search) items = items.filter((x) => x.name.toLowerCase().includes(search) || x.username.toLowerCase().includes(search));
  if (status === "active") items = items.filter((x) => x.isActive);
  if (status === "inactive") items = items.filter((x) => !x.isActive);
  return json(paginate(items, req.url));
}

export async function POST(req) {
  const ctx = await guard(req, "User.create");
  if (ctx.response) return ctx.response;
  const { store } = ctx;
  const body = await parseBody(req);
  const errors = {};
  if (!body.name) errors.name = ["The name field is required."];
  if (!body.username) errors.username = ["The username field is required."];
  else if (store.users.some((x) => x.username === body.username)) errors.username = ["The username has already been taken."];
  if (!body.password) errors.password = ["The password field is required."];
  else if (body.password !== body.password_confirmation) errors.password = ["The password confirmation does not match."];
  if (Object.keys(errors).length) return err(422, "The given data was invalid.", errors);

  const user = {
    id: ulid(), name: body.name, speciality: body.speciality || "", username: body.username,
    password: body.password, isActive: body.isActive !== false,
    roles: Array.isArray(body.roles) ? body.roles : [],
    preference: { ...CONSTANTS.DEFAULT_PREFERENCE },
  };
  store.users.push(user);
  return jsonP({ data: userWithPermissions(store, user) }, 201);
}
