import { json, guard, parseBody, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const g = await guard(req, "PacsSetting.view");
  if (g.response) return g.response;
  return json({ data: g.store.pacsSetting });
}

export async function PUT(req) {
  const g = await guard(req, "PacsSetting.update");
  if (g.response) return g.response;
  const body = await parseBody(req);
  const p = g.store.pacsSetting;
  for (const k of ["dicomHost", "dicomAet", "webUrl", "username", "password"]) if (body[k] !== undefined) p[k] = body[k];
  if (body.dicomPort !== undefined) p.dicomPort = Number(body.dicomPort) || 11112;
  return jsonP({ data: p });
}
