import { json, guard, paginate } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const g = await guard(req, "Study.view");
  if (g.response) return g.response;
  const { store } = g;
  const u = new URL(req.url);
  const patientId = (u.searchParams.get("patientId") || "").toLowerCase().trim();
  const patientName = (u.searchParams.get("patientName") || "").toLowerCase().trim();
  const modality = u.searchParams.get("modality") || "";
  const studyDate = u.searchParams.get("studyDate") || "";

  let items = store.studies.slice();
  if (g.auth.isGuest) items = items.filter((s) => s.studyInstanceUid === g.auth.studyInstanceUid);
  if (patientId) items = items.filter((s) => s.patientId.toLowerCase().includes(patientId));
  if (patientName) items = items.filter((s) => s.patientName.toLowerCase().includes(patientName));
  if (modality && modality !== "all") items = items.filter((s) => s.modality.split(",").map((m) => m.trim()).includes(modality));
  if (studyDate) {
    const [from, to] = studyDate.split(",");
    if (from) items = items.filter((s) => s.studyDate >= from);
    if (to) items = items.filter((s) => s.studyDate <= to);
  }
  items = items.sort((a, b) => (a.studyDate + a.studyTime < b.studyDate + b.studyTime ? 1 : -1));
  return json(paginate(items, req.url));
}
