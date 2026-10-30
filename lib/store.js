// In-memory demo data store for the sPACS rebuild.
// Seeded deterministically once per server instance. Writes persist for the
// lifetime of a warm serverless instance (demo only — no external DB required).

import crypto from "node:crypto";

const PERMISSIONS = [
  "Preference.view", "Preference.update",
  "PrintTemplate.viewOwn", "PrintTemplate.viewAny", "PrintTemplate.listOwn", "PrintTemplate.listAny",
  "PrintTemplate.createOwn", "PrintTemplate.createAny", "PrintTemplate.updateOwn", "PrintTemplate.updateAny",
  "PrintTemplate.deleteOwn", "PrintTemplate.deleteAny",
  "ReportTemplate.listOwn", "ReportTemplate.listAny", "ReportTemplate.create",
  "ReportTemplate.updateOwn", "ReportTemplate.updateAny", "ReportTemplate.deleteOwn", "ReportTemplate.deleteAny",
  "Report.view", "Report.create", "Report.updateOwn", "Report.updateAny", "Report.finalize",
  "Report.deleteOwn", "Report.deleteAny",
  "Study.view", "StudyShare.create",
  "PacsSetting.view", "PacsSetting.update",
  "PortalSetting.view", "PortalSetting.update",
  "Role.view", "Role.list", "Role.create", "Role.update", "Role.delete",
  "User.view", "User.list", "User.create", "User.update",
  "User.revokeAllTokens", "User.generateAccessToken", "User.impersonate",
];

const DOCTOR_PERMISSIONS = [
  "Preference.view", "Preference.update",
  "PrintTemplate.viewOwn", "PrintTemplate.viewAny", "PrintTemplate.listOwn", "PrintTemplate.listAny",
  "PrintTemplate.createOwn", "PrintTemplate.createAny", "PrintTemplate.updateOwn", "PrintTemplate.updateAny",
  "PrintTemplate.deleteOwn", "PrintTemplate.deleteAny",
  "ReportTemplate.listOwn", "ReportTemplate.listAny", "ReportTemplate.create",
  "ReportTemplate.updateOwn", "ReportTemplate.updateAny", "ReportTemplate.deleteOwn", "ReportTemplate.deleteAny",
  "Report.view", "Report.create", "Report.updateOwn", "Report.updateAny", "Report.finalize",
  "Report.deleteOwn", "Report.deleteAny",
  "Study.view", "StudyShare.create", "User.list",
];

const MODALITIES = ["DX", "CT", "MG", "MR", "XA", "CR", "DR", "NM", "XD", "PT", "US", "RF"];

function ulid() {
  const t = Date.now().toString(36).toUpperCase().padStart(10, "0");
  let r = "";
  const chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  for (let i = 0; i < 16; i++) r += chars[Math.floor(Math.random() * 32)];
  return `${t.slice(0, 8)}-${t.slice(8, 10)}${r.slice(0, 2)}-${r.slice(2, 6)}-${r.slice(6, 10)}-${r.slice(10)}`.toLowerCase();
}

const DEFAULT_PREFERENCE = {
  modalities: MODALITIES.slice(),
  autoRefreshPeriod: 60,
  navigationLayout: "compact",
  defaultHomePage: "/studies",
};

function buildStore() {
  const roles = [
    { id: ulid(), name: "admin", permissions: PERMISSIONS.slice(), isSystem: true },
    { id: ulid(), name: "doctor", permissions: DOCTOR_PERMISSIONS.slice(), isSystem: true },
    { id: ulid(), name: "guest", permissions: ["Study.view"], isSystem: true },
  ];

  const users = [
    {
      id: ulid(), name: "Doctor", speciality: "Radiologist", username: "doctor",
      password: "12345678", isActive: true, roles: ["doctor"],
      preference: { ...DEFAULT_PREFERENCE, defaultHomePage: "/studies" },
    },
    {
      id: ulid(), name: "System Administrator", speciality: "IT", username: "admin",
      password: "admin", isActive: true, roles: ["admin"],
      preference: { ...DEFAULT_PREFERENCE, navigationLayout: "sidenav", defaultHomePage: "/" },
    },
    {
      id: ulid(), name: "Sara Kareem", speciality: "Consultant Radiologist", username: "sara",
      password: "sara", isActive: true, roles: ["doctor"], preference: { ...DEFAULT_PREFERENCE },
    },
    {
      id: ulid(), name: "Ali Hassan", speciality: "Registrar", username: "ali",
      password: "ali", isActive: false, roles: ["doctor"], preference: { ...DEFAULT_PREFERENCE },
    },
  ];

  const studies = [
    mkStudy("1.3.46.670589.30.42.0.1.128635487345226.1793375982679.1", "824102", "DONIA MOHAMMAD RIDA", "34 Y", "Female", "CR", "Knee", "2026-10-30", "04:00 PM"),
    mkStudy("1.3.12.2.1107.5.99.1.22634.30000026103012212975000000001", "26.10.30-15:21:29-STD-1.3.12", "noria abed al ameer", "48 Y", "Female", "XA", "Coronary^Diagnostic Coronary Catheterization", "2026-10-30", "03:02 PM"),
    mkStudy("1.3.46.670589.11.47578.5.0.265900.2026103014492995006", "992764", "TABARAK ALI ABED ALAMEER", "13 Y", "Female", "MR", "CMR", "2026-10-30", "02:57 PM"),
    mkStudy("1.3.46.670589.11.47578.5.0.265900.2026103014295220004", "992876", "AHMED ALAA ABED ALJALIL", "17 Y", "Male", "MR", "RT_KNEE", "2026-10-30", "02:29 PM"),
    mkStudy("1.3.46.670589.30.42.0.1.128635487345226.1793369306089.1", "176204", "HASHIM HASAN", "\u2014", "Male", "CR", "Abdomen", "2026-10-30", "02:10 PM"),
    mkStudy("1.3.46.670589.30.42.0.1.128635487345226.1793367147273.1", "992866", "MONTAHA KAREEM BANDR", "\u2014", "Female", "CR", "Knee L", "2026-10-30", "01:55 PM"),
    mkStudy("1.2.826.0.1.3680043.8.498.10010.20261029.9001", "500231", "YOUSIF ABBAS", "62 Y", "Male", "CT", "CT Brain Without Contrast", "2026-10-29", "11:20 AM"),
    mkStudy("1.2.826.0.1.3680043.8.498.10010.20261029.9002", "500232", "MARYAM SALEH", "29 Y", "Female", "US", "Abdomen Complete", "2026-10-29", "09:05 AM"),
  ];

  // Seed a finalized report on the first study so every state is visible.
  const firstReportId = ulid();
  studies[0].report = {
    id: firstReportId,
    studyInstanceUid: studies[0].studyInstanceUid,
    status: "amended",
    content: encodeReport({
      header: `<p><strong>${studies[0].patientName}</strong>, ${studies[0].gender} (${studies[0].age}) — ${studies[0].patientId}</p>`,
      bodyPages: [`<p>Findings: No acute osseous injury. Joint spaces preserved.</p>`],
      footer: `<p>Doctor — Radiologist</p>`,
    }),
    finalizedAt: "2026-10-30T16:01:47+03:00",
    author: { id: users[0].id },
    revisionsCount: 1,
  };

  const reportRevisions = {
    [firstReportId]: [
      { id: ulid(), reportId: firstReportId, content: "<p>Initial draft</p>", reason: "Initial", createdAt: "2026-10-30T15:40:00+03:00", author: "Doctor" },
      { id: ulid(), reportId: firstReportId, content: "<p>Amended impression</p>", reason: "Correction of impression", createdAt: "2026-10-30T16:01:56+03:00", author: "Doctor" },
    ],
  };

  const printTemplates = [
    {
      id: ulid(), name: "Default Report Letterhead", isDefault: true, userId: null,
      header: `<p style="font-weight:bold">IZA HOSPITAL — RADIOLOGY DEPARTMENT</p><p>{{ patientName }} • {{ patientId }} • {{ modality }} • {{ studyDate }}</p>`,
      footer: `<p>Reported by {{ userName }} ({{ userSpeciality }}) on {{ reportDate }}</p><p>Printed {{ currentDate }}</p>`,
      includePortalQr: true,
    },
    {
      id: ulid(), name: "Compact Footer", isDefault: false, userId: users[0].id,
      header: ``,
      footer: `<p>IZA Hospital • {{ currentDate }}</p>`,
      includePortalQr: false,
    },
  ];

  const reportTemplates = [
    { id: ulid(), name: "CT Brain — Normal", userId: null, content: "<h4>Clinical Indication</h4><p></p><h4>Technique</h4><p>Axial non-contrast CT of the brain.</p><h4>Findings</h4><p>No acute intracranial hemorrhage, mass effect, edema or midline shift.</p><h4>Impression</h4><p>Unremarkable non-contrast head CT.</p>" },
    { id: ulid(), name: "Chest X-Ray — Normal", userId: null, content: "<h4>Findings</h4><p>Clear lungs. No focal consolidation or effusion.</p><h4>Impression</h4><p>Normal chest radiograph.</p>" },
    { id: ulid(), name: "Knee MRI — Template", userId: users[0].id, content: "<h4>Findings</h4><p>Menisci and ligaments intact. No marrow edema.</p><h4>Impression</h4><p>No internal derangement.</p>" },
  ];

  return {
    roles, users, studies, reportRevisions, printTemplates, reportTemplates,
    studyShares: [],
    tokens: {},          // token -> { userId, isGuest, studyInstanceUid, issuedAt }
    pacsSetting: {
      dicomHost: "dicom.iza-hospital.local",
      dicomPort: 11112,
      dicomAet: "IZA_PACS",
      webUrl: "https://dicom.iza-hospital.local/dicom-web",
      username: "pacsuser",
      password: "pacs-pass",
    },
    portalSetting: {
      logoUrl: null,
      title: "بوابة الفحوصات الطبية",
      description: "مرحباً بك في بوابة عرض الفحوصات الطبية الآمنة.",
      redirectDelay: 3,
      footerText: "جميع الحقوق محفوظة",
      showStudyDetailsInQr: true,
    },
  };
}

function mkStudy(uid, patientId, patientName, age, gender, modality, studyDescription, studyDate, studyTime) {
  return { studyInstanceUid: uid, patientId, patientName, age, gender, modality, studyDescription, studyDate, studyTime, report: null };
}

export function encodeReport({ header = "", bodyPages = [""], footer = "" } = {}) {
  const body = bodyPages.map((p) => (p == null ? "" : String(p))).join("\n<!-- PAGE_BREAK -->\n");
  return [
    "<!-- REPORT_HEADER_START -->", `<div class="report-header">${header}</div>`, "<!-- REPORT_HEADER_END -->",
    "<!-- REPORT_BODY_START -->", `<div class="report-body">${body}</div>`, "<!-- REPORT_BODY_END -->",
    "<!-- REPORT_FOOTER_START -->", `<div class="report-footer">${footer}</div>`, "<!-- REPORT_FOOTER_END -->",
  ].join("\n");
}

export function decodeReport(html = "") {
  const sect = (re) => (html.match(re) ? html.match(re)[1].trim() : "");
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

export function permissionsForRoles(store, roleNames) {
  const set = new Set();
  for (const r of store.roles) if (roleNames.includes(r.name)) r.permissions.forEach((p) => set.add(p));
  return [...set];
}

export function userWithPermissions(store, user) {
  return {
    id: user.id, name: user.name, speciality: user.speciality, username: user.username,
    isActive: user.isActive, roles: user.roles,
    permissions: permissionsForRoles(store, user.roles),
    preference: user.preference || { ...DEFAULT_PREFERENCE },
  };
}

export function getStore() {
  if (!globalThis.__SPACS_STORE__) globalThis.__SPACS_STORE__ = buildStore();
  return globalThis.__SPACS_STORE__;
}

const SECRET = process.env.SPACS_SECRET || "spacs-demo-secret-do-not-use-in-production";

function b64url(obj) { return Buffer.from(JSON.stringify(obj)).toString("base64url"); }
function sign(payload) { return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url").slice(0, 32); }
function decodeToken(token) {
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  try { return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return null; }
}

export function issueToken(store, { userId = null, isGuest = false, studyInstanceUid = null }) {
  // Stateless, self-signed token so any serverless instance can validate it.
  const payload = b64url({ u: userId, g: isGuest ? 1 : 0, s: studyInstanceUid, t: Date.now() });
  const token = `${payload}.${sign(payload)}`;
  store.tokens[token] = { userId, isGuest, studyInstanceUid, issuedAt: Date.now() };
  // Keep the persisted token bookkeeping bounded.
  const entries = Object.entries(store.tokens);
  if (entries.length > 300) {
    entries.sort((a, b) => (a[1].issuedAt || 0) - (b[1].issuedAt || 0));
    for (const [k] of entries.slice(0, entries.length - 300)) delete store.tokens[k];
  }
  return token;
}

export function authFromRequest(store, req) {
  const h = req.headers.get("authorization") || "";
  let m = h.match(/^Bearer\s+(.+)$/i);
  let tokenValue = m ? m[1] : null;
  if (!tokenValue) {
    // Allow <img>/Worker image loads to authenticate via ?token= query.
    try { tokenValue = new URL(req.url).searchParams.get("token"); } catch {}
  }
  if (!tokenValue) return null;

  let rec = store.tokens[tokenValue];
  if (!rec) {
    const decoded = decodeToken(tokenValue);
    if (!decoded) return null;
    rec = { userId: decoded.u, isGuest: !!decoded.g, studyInstanceUid: decoded.s };
  }
  m = [null, tokenValue];
  if (rec.isGuest) {
    return {
      isGuest: true, studyInstanceUid: rec.studyInstanceUid, token: m[1],
      user: {
        id: "guest", name: "Guest", speciality: "Patient Portal", username: "guest",
        isActive: true, roles: ["guest"], permissions: ["Study.view"],
        preference: { ...DEFAULT_PREFERENCE, defaultHomePage: "/studies" },
      },
    };
  }
  const user = store.users.find((u) => u.id === rec.userId);
  if (!user || !user.isActive) return null;
  return { isGuest: false, token: m[1], user: userWithPermissions(store, user), raw: user };
}

export const CONSTANTS = { PERMISSIONS, MODALITIES, DEFAULT_PREFERENCE };
export { ulid };
