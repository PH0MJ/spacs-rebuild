import { json, guard, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const g = await guard(req, "PortalSetting.view");
  if (g.response) return g.response;
  return json({ data: g.store.portalSetting });
}

// Accepts multipart/form-data (logo upload) or JSON.
export async function POST(req) {
  const g = await guard(req, "PortalSetting.update");
  if (g.response) return g.response;
  const ct = req.headers.get("content-type") || "";
  let body = {};
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    for (const key of ["title", "description", "footerText"]) {
      if (form.has(key)) body[key] = String(form.get(key));
    }
    if (form.has("redirectDelay")) body.redirectDelay = Number(form.get("redirectDelay")) || 0;
    if (form.has("showStudyDetailsInQr")) body.showStudyDetailsInQr = String(form.get("showStudyDetailsInQr")) === "1";
    if (form.has("logo")) {
      const logo = form.get("logo");
      body.logoUrl = logo && typeof logo === "object" && logo.size > 0 ? `uploads/${logo.name}` : null;
    }
  } else {
    body = await req.json().catch(() => ({}));
  }
  const p = g.store.portalSetting;
  for (const k of ["title", "description", "footerText", "logoUrl"]) if (body[k] !== undefined) p[k] = body[k];
  if (body.redirectDelay !== undefined) p.redirectDelay = Number(body.redirectDelay) || 0;
  if (body.showStudyDetailsInQr !== undefined) p.showStudyDetailsInQr = !!body.showStudyDetailsInQr;
  return jsonP({ data: p });
}
