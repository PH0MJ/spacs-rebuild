import { getStore, ulid } from "@/lib/store";
import { json, guard, parseBody, err } from "@/lib/api";

export const dynamic = "force-dynamic";

export function GET(req) {
  const g = guard(req, ["ReportTemplate.listAny", "ReportTemplate.listOwn"]);
  if (g.response) return g.response;
  return json({ data: g.store.reportTemplates });
}

export async function POST(req) {
  const g = guard(req, "ReportTemplate.create");
  if (g.response) return g.response;
  const body = await parseBody(req);
  if (!body.name) return err(422, "The given data was invalid.", { name: ["The name field is required."] });
  const tpl = { id: ulid(), name: body.name, content: body.content || "", userId: g.auth.user.id };
  g.store.reportTemplates.unshift(tpl);
  return json({ data: tpl }, 201);
}
