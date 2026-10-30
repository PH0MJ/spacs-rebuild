import { json, guard, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

export function GET(req) {
  const g = guard(req, "Preference.view");
  if (g.response) return g.response;
  return json({ data: g.auth.user.preference });
}

export async function PUT(req) {
  const g = guard(req, "Preference.update");
  if (g.response) return g.response;
  const body = await parseBody(req);
  const pref = g.auth.user.preference || {};
  if (Array.isArray(body.modalities)) pref.modalities = body.modalities;
  if (body.autoRefreshPeriod !== undefined) pref.autoRefreshPeriod = Number(body.autoRefreshPeriod) || 0;
  if (body.navigationLayout) pref.navigationLayout = body.navigationLayout;
  if (body.defaultHomePage) pref.defaultHomePage = body.defaultHomePage;
  if (g.auth.raw) g.auth.raw.preference = pref;
  return json({ data: pref });
}
