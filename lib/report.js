// Report document codec — identical contract to the reverse-engineered app.
export const PAGE_BREAK = "<!-- PAGE_BREAK -->";

export function encodeReport({ header = "", bodyPages = [""], footer = "" } = {}) {
  const body = bodyPages.map((p) => p ?? "").join("\n" + PAGE_BREAK + "\n");
  return [
    "<!-- REPORT_HEADER_START -->", `<div class="report-header">${header}</div>`, "<!-- REPORT_HEADER_END -->",
    "<!-- REPORT_BODY_START -->", `<div class="report-body">${body}</div>`, "<!-- REPORT_BODY_END -->",
    "<!-- REPORT_FOOTER_START -->", `<div class="report-footer">${footer}</div>`, "<!-- REPORT_FOOTER_END -->",
  ].join("\n");
}

export function decodeReport(html = "") {
  const sect = (re) => { const m = html.match(re); return m ? m[1].trim() : ""; };
  const strip = (s, cls) => {
    const m = s.match(new RegExp(`^\\s*<div[^>]*class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]*?)<\\/div>\\s*$`, "i"));
    return m ? m[1].trim() : s;
  };
  const header = strip(sect(/REPORT_HEADER_START([\s\S]*?)REPORT_HEADER_END/), "report-header");
  const body = strip(sect(/REPORT_BODY_START([\s\S]*?)REPORT_BODY_END/), "report-body");
  const footer = strip(sect(/REPORT_FOOTER_START([\s\S]*?)REPORT_FOOTER_END/), "report-footer");
  const bodyPages = body.split(/<!--\s*PAGE_BREAK\s*-->/).map((s) => s.trim());
  return { header, body, bodyPages: bodyPages.length ? bodyPages : [""], footer };
}

export function renderTemplate(tpl, vars) {
  if (!tpl) return "";
  return tpl.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_m, k) => {
    if (Object.prototype.hasOwnProperty.call(vars, k)) return vars[k] ?? "";
    const low = k.toLowerCase();
    for (const [vk, vv] of Object.entries(vars)) if (vk.toLowerCase() === low) return vv ?? "";
    return "";
  });
}

export function buildVars(study, user) {
  const now = new Date();
  return {
    patientName: study?.patientName || "",
    patientId: study?.patientId || "",
    age: study?.age || "",
    gender: study?.gender || "",
    studyDate: study?.studyDate || "",
    studyTime: study?.studyTime || "",
    studyDescription: study?.studyDescription || "",
    modality: study?.modality || "",
    accessionNumber: "",
    userName: user?.name || "",
    userSpeciality: user?.speciality || "",
    reportDate: now.toISOString().slice(0, 10),
    currentDate: now.toISOString().slice(0, 10),
  };
}
