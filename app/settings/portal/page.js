"use client";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { PageLayout } from "@/components/PageLayout";

export default function PortalSettingsPage() {
  const { api, toast } = useSession();
  const [form, setForm] = useState({ logoUrl: null, title: "", description: "", redirectDelay: 3, footerText: "", showStudyDetailsInQr: true });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const load = () => api("/settings/portal").then((r) => r.ok && setForm({ ...r.data.data }));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const save = async () => {
    setBusy(true); setErrors({});
    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("description", form.description);
    fd.append("redirectDelay", String(form.redirectDelay));
    fd.append("footerText", form.footerText);
    fd.append("showStudyDetailsInQr", form.showStudyDetailsInQr ? "1" : "0");
    const res = await api("/settings/portal", { form: fd, method: "POST" });
    setBusy(false);
    if (res.ok) { setForm({ ...res.data.data }); toast.operationSuccessful(); }
    else setErrors(res.data?.errors || {});
  };

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((p) => ({ ...p, logoUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  return (
    <PageLayout title="Portal Settings" backTo="/" actions={<button className="btn primary" disabled={busy} onClick={save}>Save Settings</button>}>
      <div className="card pad">
        <div className="grid2">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field"><label className="label">Logo</label><input className="input" type="file" accept="image/*" onChange={onLogo} />
              {form.logoUrl ? <img src={form.logoUrl} alt="logo" style={{ maxHeight: 60, marginTop: 6, background: "#fff", borderRadius: 8, padding: 4 }} /> : <span className="muted tiny">No logo</span>}
              {form.logoUrl ? <button className="btn sm" onClick={() => setForm((p) => ({ ...p, logoUrl: null }))}>Remove logo</button> : null}
            </div>
            <div className="field"><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div className="field"><label className="label">Description</label><textarea className="textarea" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="field"><label className="label">Redirect Delay (seconds)</label><input className="input" type="number" style={{ maxWidth: 160 }} value={form.redirectDelay} onChange={(e) => setForm((p) => ({ ...p, redirectDelay: e.target.value }))} /></div>
            <div className="field"><label className="label">Footer Text</label><input className="input" value={form.footerText} onChange={(e) => setForm((p) => ({ ...p, footerText: e.target.value }))} /></div>
            <label className="row small"><input type="checkbox" checked={form.showStudyDetailsInQr} onChange={(e) => setForm((p) => ({ ...p, showStudyDetailsInQr: e.target.checked }))} /> Show study details in QR</label>
          </div>
          <div>
            <div className="label">Public Portal Preview</div>
            <div className="card pad" dir="rtl" style={{ marginTop: 8, textAlign: "center", background: "#fff", color: "#111", minHeight: 320, display: "flex", flexDirection: "column", gap: 12, alignItems: "center", justifyContent: "center" }}>
              {form.logoUrl ? <img src={form.logoUrl} alt="logo" style={{ maxHeight: 70 }} /> : <span className="grad-text" style={{ fontSize: 30, fontWeight: 900 }}>sPACS</span>}
              <div style={{ fontSize: 20, fontWeight: 800 }}>{form.title || "بوابة الفحوصات الطبية"}</div>
              <p className="muted small">{form.description}</p>
              <div style={{ width: "100%", maxWidth: 260, height: 8, background: "#e2e8f0", borderRadius: 999 }}><div style={{ width: "60%", height: "100%", background: "var(--brand)", borderRadius: 999 }} /></div>
              <div className="muted tiny">{form.footerText}</div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
