// End-to-end API verification against the live deployment.
const BASE = process.env.BASE || "https://spacs-rebuild.vercel.app";

const results = [];
let token = "";
function rec(name, ok, detail) { results.push({ name, ok, detail }); }

async function call(method, path, { body, form, auth = true, raw = false } = {}) {
  const headers = { "X-Locale": "en", Accept: "application/json" };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const ct = res.headers.get("content-type") || "";
  let data = null;
  if (ct.includes("json")) data = await res.json().catch(() => null);
  else if (raw) data = await res.text().catch(() => null);
  else data = await res.text().catch(() => null);
  return { status: res.status, ok: res.ok, data, ct };
}
function snippet(d) {
  const s = typeof d === "string" ? d : JSON.stringify(d);
  return s ? s.slice(0, 110) : "";
}

(async () => {
  console.log("Base:", BASE, "\n");

  // ---- public / auth ----
  let r = await call("GET", "/api/portal-settings", { auth: false });
  rec("GET /api/portal-settings (public)", r.status === 200 && r.data?.data?.title, `${r.status} ${snippet(r.data)}`);

  r = await call("GET", "/api/studies", { auth: false });
  rec("GET /api/studies (no token → 401)", r.status === 401, `${r.status} ${snippet(r.data)}`);

  r = await call("POST", "/api/auth/login", { auth: false, body: { username: "doctor", password: "wrongpass" } });
  rec("POST /api/auth/login (bad creds → 422)", r.status === 422 && r.data?.errors, `${r.status} ${snippet(r.data)}`);

  r = await call("POST", "/api/auth/login", { auth: false, body: { username: "doctor", password: "12345678", device_name: "test" } });
  rec("POST /api/auth/login (doctor)", r.status === 200 && r.data?.token, `${r.status} user=${r.data?.user?.username} perms=${r.data?.user?.permissions?.length}`);
  const doctorToken = r.data?.token;

  r = await call("POST", "/api/auth/demo-session", { auth: false });
  rec("POST /api/auth/demo-session", r.status === 200 && r.data?.token, `${r.status} user=${r.data?.user?.username} roles=${r.data?.user?.roles?.join(",")}`);
  token = r.data?.token;

  r = await call("GET", "/api/auth/user");
  rec("GET /api/auth/user", r.status === 200 && r.data?.data, `${r.status} ${snippet(r.data?.data?.name)}`);

  // doctor token must NOT access users (RBAC)
  const saved = token; token = doctorToken;
  r = await call("GET", "/api/users");
  rec("GET /api/users (doctor → 403, RBAC)", r.status === 403, `${r.status} ${snippet(r.data)}`);
  token = saved;

  // ---- reads ----
  const reads = [
    ["GET", "/api/permissions", (d) => Array.isArray(d) && d.length > 40],
    ["GET", "/api/users", (d) => d?.data?.length >= 4 && d?.meta?.total],
    ["GET", "/api/users/list", (d) => d?.data?.length >= 4],
    ["GET", "/api/roles", (d) => d?.data?.length >= 3],
    ["GET", "/api/roles/list", (d) => d?.data?.length >= 3],
    ["GET", "/api/preferences", (d) => d?.data?.navigationLayout !== undefined],
    ["GET", "/api/studies", (d) => d?.data?.length >= 8],
    ["GET", "/api/studies?modality=CT", (d) => d?.data?.every((s) => s.modality.includes("CT"))],
    ["GET", "/api/studies?patientName=noria", (d) => d?.data?.some((s) => /noria/i.test(s.patientName))],
    ["GET", "/api/print-templates", (d) => d?.data?.length >= 2],
    ["GET", "/api/report-templates", (d) => d?.data?.length >= 3],
    ["GET", "/api/settings/pacs", (d) => d?.data?.dicomPort !== undefined],
    ["GET", "/api/settings/portal", (d) => d?.data?.redirectDelay !== undefined],
  ];
  for (const [m, p, check] of reads) {
    const rr = await call(m, p);
    let ok = false;
    try { ok = rr.status === 200 && !!check(rr.data); } catch { ok = false; }
    rec(`${m} ${p}`, ok, `${rr.status} ${snippet(rr.data)}`);
  }

  // study detail + report + dicom web
  const uid = "1.2.826.0.1.3680043.8.498.10010.20261029.9001";
  const e = encodeURIComponent;
  r = await call("GET", `/api/studies/${e(uid)}`);
  rec("GET /api/studies/{uid}", r.status === 200 && r.data?.data?.studyInstanceUid === uid, `${r.status} ${snippet(r.data?.data?.patientName)}`);

  r = await call("GET", `/api/studies/${e(uid)}/report`);
  rec("GET /api/studies/{uid}/report", r.status === 200 && "data" in r.data, `${r.status} report=${r.data?.data ? r.data.data.status : "null"}`);

  r = await call("GET", `/api/dicom-web/studies/${e(uid)}/series`);
  const seriesUid = r.data?.[0]?.seriesInstanceUID;
  rec("GET /api/dicom-web/.../series", r.status === 200 && Array.isArray(r.data) && r.data.length >= 1, `${r.status} count=${r.data?.length} first=${r.data?.[0]?.seriesDescription}`);

  r = await call("GET", `/api/dicom-web/studies/${e(uid)}/series/${e(seriesUid)}/metadata`);
  rec("GET /api/dicom-web/.../metadata", r.status === 200 && r.data?.data?.length >= 1, `${r.status} ${snippet(r.data?.data?.[0])}`);

  const inst = seriesUid + ".1";
  r = await call("GET", `/api/dicom-web/studies/${e(uid)}/series/${e(seriesUid)}/instances/${e(inst)}/metadata`);
  rec("GET /api/dicom-web/.../instances/{i}/metadata", r.status === 200 && r.data?.data?.length === 1, `${r.status} ${snippet(r.data?.data?.[0]?.sopInstanceUID)}`);

  const fr = await fetch(`${BASE}/api/dicom-web/studies/${e(uid)}/series/${e(seriesUid)}/instances/${e(inst)}/frames/1/rendered?token=${e(token)}`);
  const svg = await fr.text();
  rec("GET /api/dicom-web/.../frames/1/rendered (SVG)", fr.status === 200 && svg.includes("<svg"), `${fr.status} type=${fr.headers.get("content-type")} bytes=${svg.length}`);

  // ---- writes ----
  r = await call("POST", `/api/studies/${e(uid)}/reports/draft`, { body: { content: "<!-- REPORT_HEADER_START --><div class=\"report-header\">H</div><!-- REPORT_HEADER_END --><!-- REPORT_BODY_START --><div class=\"report-body\">Draft body {{x}}</div><!-- REPORT_BODY_END --><!-- REPORT_FOOTER_START --><div class=\"report-footer\">F</div><!-- REPORT_FOOTER_END -->" } });
  const draftReportId = r.data?.data?.id;
  rec("POST /api/studies/{uid}/reports/draft", r.status === 200 && r.data?.data?.status === "draft", `${r.status} status=${r.data?.data?.status}`);

  r = await call("POST", `/api/studies/${e(uid)}/reports/finalize`, { body: { content: "<div class=\"report-body\">Final body</div>" } });
  rec("POST /api/studies/{uid}/reports/finalize", r.status === 200 && r.data?.data?.status === "final", `${r.status} status=${r.data?.data?.status} finalizedAt=${!!r.data?.data?.finalizedAt}`);

  r = await call("POST", `/api/studies/${e(uid)}/reports/amend`, { body: { content: "<div class=\"report-body\">Amended</div>", revisionReason: "Correction" } });
  const reportId = r.data?.data?.id;
  rec("POST /api/studies/{uid}/reports/amend", r.status === 200 && r.data?.data?.status === "amended", `${r.status} status=${r.data?.data?.status}`);

  if (reportId) {
    r = await call("GET", `/api/reports/${e(reportId)}/revisions`);
    rec("GET /api/reports/{id}/revisions", r.status === 200 && Array.isArray(r.data?.data) && r.data.data.length >= 2, `${r.status} revisions=${r.data?.data?.length}`);
  }

  r = await call("POST", "/api/study-shares", { body: { studyInstanceUid: uid, expiresAt: null } });
  const shareId = r.data?.data?.id;
  rec("POST /api/study-shares", r.status === 201 && r.data?.data?.shareLink, `${r.status} ${snippet(r.data?.data?.shareLink)}`);

  if (shareId) {
    r = await call("POST", `/api/study-shares/${e(shareId)}/generate-token`, { auth: false });
    const gtok = r.data?.token;
    rec("POST /api/study-shares/{id}/generate-token (public)", r.status === 200 && r.data?.user?.username === "guest", `${r.status} guest=${r.data?.user?.username} study=${!!r.data?.studyInstanceUid}`);
    if (gtok) {
      // guest can read that study but not others / not users
      const gs = await fetch(`${BASE}/api/studies`, { headers: { Authorization: `Bearer ${gtok}` } });
      const gsj = await gs.json();
      const gu = await fetch(`${BASE}/api/users`, { headers: { Authorization: `Bearer ${gtok}` } });
      rec("guest token scoped: /studies only that study", gs.status === 200 && gsj.data?.length === 1 && gsj.data[0].studyInstanceUid === uid, `${gs.status} count=${gsj.data?.length}`);
      rec("guest token denied /api/users (403)", gu.status === 403, `${gu.status}`);
    }
  }

  // preferences write
  r = await call("PUT", "/api/preferences", { body: { modalities: ["CT", "MR"], autoRefreshPeriod: 90, navigationLayout: "topbar", defaultHomePage: "/studies" } });
  rec("PUT /api/preferences", r.status === 200 && r.data?.data?.autoRefreshPeriod === 90, `${r.status} ${snippet(r.data?.data)}`);

  // pacs settings write
  r = await call("PUT", "/api/settings/pacs", { body: { dicomHost: "10.0.0.9", dicomPort: 104, dicomAet: "TEST_AET", webUrl: "https://x/web", username: "u", password: "p" } });
  rec("PUT /api/settings/pacs", r.status === 200 && r.data?.data?.dicomPort === 104, `${r.status} port=${r.data?.data?.dicomPort}`);

  // portal settings write
  r = await call("POST", "/api/settings/portal", { body: { title: "Test Portal", description: "d", redirectDelay: 2, footerText: "f", showStudyDetailsInQr: false } });
  rec("POST /api/settings/portal (json)", r.status === 200 && r.data?.data?.title === "Test Portal", `${r.status} ${snippet(r.data?.data)}`);

  // roles CRUD
  r = await call("POST", "/api/roles", { body: { name: "tech-test", permissions: ["Study.view", "Report.view"] } });
  const roleId = r.data?.data?.id;
  rec("POST /api/roles", r.status === 201 && roleId, `${r.status} ${snippet(r.data?.data)}`);
  if (roleId) {
    r = await call("PUT", `/api/roles/${e(roleId)}`, { body: { name: "tech-test-2", permissions: ["Study.view"] } });
    rec("PUT /api/roles/{id}", r.status === 200 && r.data?.data?.name === "tech-test-2", `${r.status} name=${r.data?.data?.name}`);
    r = await call("DELETE", `/api/roles/${e(roleId)}`);
    rec("DELETE /api/roles/{id}", r.status === 200, `${r.status} ${snippet(r.data)}`);
  }

  // users CRUD
  r = await call("POST", "/api/users", { body: { name: "Test User", speciality: "Tester", username: "testuser1", password: "secret123", password_confirmation: "secret123", isActive: true, roles: ["doctor"] } });
  const newUserId = r.data?.data?.id;
  rec("POST /api/users", r.status === 201 && newUserId, `${r.status} ${snippet(r.data?.data?.username)}`);
  if (newUserId) {
    r = await call("PUT", `/api/users/${e(newUserId)}`, { body: { name: "Test User Renamed", roles: ["doctor", "guest"] } });
    rec("PUT /api/users/{id}", r.status === 200 && r.data?.data?.name === "Test User Renamed", `${r.status} name=${r.data?.data?.name}`);
    r = await call("POST", `/api/users/${e(newUserId)}/generate-access-token`);
    rec("POST /api/users/{id}/generate-access-token", r.status === 200 && r.data?.data?.accessToken, `${r.status} token=${!!r.data?.data?.accessToken}`);
    r = await call("POST", `/api/users/${e(newUserId)}/revoke-tokens`);
    rec("POST /api/users/{id}/revoke-tokens", r.status === 200, `${r.status}`);
    r = await call("POST", `/api/users/${e(newUserId)}/impersonate`);
    rec("POST /api/users/{id}/impersonate", r.status === 200 && r.data?.token, `${r.status} user=${r.data?.user?.username}`);
  }

  // validation error shape
  r = await call("POST", "/api/users", { body: { username: "testuser1" } });
  rec("POST /api/users (422 validation)", r.status === 422 && r.data?.errors?.name && r.data?.errors?.password, `${r.status} ${snippet(r.data?.errors)}`);

  // print templates CRUD
  r = await call("POST", "/api/print-templates", { body: { name: "Tech Template", header: "<p>{{ patientName }}</p>", footer: "<p>{{ userName }}</p>", includePortalQr: true, isDefault: false } });
  const ptId = r.data?.data?.id;
  rec("POST /api/print-templates", r.status === 201 && ptId, `${r.status} ${snippet(r.data?.data?.name)}`);
  if (ptId) {
    r = await call("GET", `/api/print-templates/${e(ptId)}`);
    rec("GET /api/print-templates/{id}", r.status === 200 && r.data?.data?.id === ptId, `${r.status}`);
    r = await call("POST", `/api/print-templates/${e(ptId)}`, { body: { name: "Tech Template 2", header: "h", footer: "f" } });
    rec("POST /api/print-templates/{id} (update)", r.status === 200 && r.data?.data?.name === "Tech Template 2", `${r.status} name=${r.data?.data?.name}`);
    r = await call("DELETE", `/api/print-templates/${e(ptId)}`);
    rec("DELETE /api/print-templates/{id}", r.status === 200, `${r.status}`);
  }

  // report templates CRUD
  r = await call("POST", "/api/report-templates", { body: { name: "Tech RT", content: "<p>Body</p>" } });
  const rtId = r.data?.data?.id;
  rec("POST /api/report-templates", r.status === 201 && rtId, `${r.status} ${snippet(r.data?.data?.name)}`);
  if (rtId) {
    r = await call("PUT", `/api/report-templates/${e(rtId)}`, { body: { name: "Tech RT 2", content: "<p>Body2</p>" } });
    rec("PUT /api/report-templates/{id}", r.status === 200 && r.data?.data?.name === "Tech RT 2", `${r.status} name=${r.data?.data?.name}`);
    r = await call("DELETE", `/api/report-templates/${e(rtId)}`);
    rec("DELETE /api/report-templates/{id}", r.status === 200, `${r.status}`);
  }

  // editor upload (multipart)
  const fd = new FormData();
  fd.append("image", new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), "x.png");
  r = await call("POST", "/api/editor/upload-image", { form: fd });
  rec("POST /api/editor/upload-image (multipart)", r.status === 200 && r.data?.data?.url?.startsWith("data:"), `${r.status} url=${(r.data?.data?.url || "").slice(0, 30)}…`);

  // logout
  r = await call("POST", "/api/auth/logout");
  rec("POST /api/auth/logout", r.status === 200, `${r.status} ${snippet(r.data)}`);

  // ---- report ----
  const pass = results.filter((x) => x.ok).length;
  console.log("ENDPOINT RESULTS");
  console.log("=".repeat(100));
  for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name.padEnd(52)} ${x.detail}`);
  console.log("=".repeat(100));
  console.log(`${pass} / ${results.length} passed`);
  const fails = results.filter((x) => !x.ok);
  if (fails.length) { console.log("\nFAILURES:"); fails.forEach((f) => console.log(" - " + f.name + " :: " + f.detail)); }
  process.exit(fails.length ? 2 : 0);
})().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(1); });
