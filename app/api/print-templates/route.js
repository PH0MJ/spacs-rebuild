import { getStore, ulid } from "@/lib/store";
import { json, guard, parseBody, err, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const g = await guard(req, ["PrintTemplate.listAny", "PrintTemplate.listOwn"]);
  if (g.response) return g.response;
  const u = new URL(req.url);
  const search = (u.searchParams.get("search") || "").toLowerCase().trim();
  const userFilter = u.searchParams.get("user") || "all";
  let items = g.store.printTemplates.map((t) => ({ ...t, user: t.userId ? { id: t.userId, name: (g.store.users.find((x) => x.id === t.userId) || {}).name } : null }));
  if (search) items = items.filter((t) => t.name.toLowerCase().includes(search));
  if (userFilter === "system") items = items.filter((t) => !t.userId);
  else if (userFilter && userFilter !== "all") items = items.filter((t) => t.userId === userFilter);
  return json({ data: items });
}

export async function POST(req) {
  const g = await guard(req, ["PrintTemplate.createOwn", "PrintTemplate.createAny"]);
  if (g.response) return g.response;
  const body = await parseBody(req);
  if (!body.name) return err(422, "The given data was invalid.", { name: ["The name field is required."] });
  const tpl = {
    id: ulid(), name: body.name, header: body.header || "", footer: body.footer || "",
    includePortalQr: body.includePortalQr !== false, isDefault: !!body.isDefault,
    userId: body.userId || (g.auth.user.permissions.includes("PrintTemplate.createAny") ? null : g.auth.user.id),
  };
  g.store.printTemplates.push(tpl);
  return jsonP({ data: tpl }, 201);
}
