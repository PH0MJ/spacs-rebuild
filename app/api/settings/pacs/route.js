import { json, guard, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export function GET(req) {
  const g = guard(req, "PacsSetting.view");
  if (g.response) return g.response;
  return json({ data: g.store.pacsSetting });
}

export async function PUT(req) {
  const g = guard(req, "PacsSetting.update");
  if (g.response) return g.response;
  const body = await parseBody(req);
  const p = g.store.pacsSetting;
  for (const k of ["dicomHost", "dicomAet", "webUrl", "username", "password"]) if (body[k] !== undefined) p[k] = body[k];
  if (body.dicomPort !== undefined) p.dicomPort = Number(body.dicomPort) || 11112;
  return json({ data: p });
}
