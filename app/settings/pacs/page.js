"use client";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { PageLayout } from "@/components/PageLayout";

export default function PacsSettingsPage() {
  const { api, toast } = useSession();
  const [form, setForm] = useState({ dicomHost: "", dicomPort: 11112, dicomAet: "", webUrl: "", username: "", password: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/settings/pacs").then((r) => { if (r.ok) setForm({ ...r.data.data }); });
    // eslint-disable-next-line
  }, []);

  const save = async () => {
    setBusy(true); setErrors({});
    const res = await api("/settings/pacs", { method: "PUT", body: { ...form, dicomPort: Number(form.dicomPort) } });
    setBusy(false);
    if (res.ok) toast.operationSuccessful();
    else setErrors(res.data?.errors || {});
  };

  const f = (k) => ({ value: form[k], onChange: (e) => setForm((p) => ({ ...p, [k]: e.target.value })) });

  return (
    <PageLayout title="PACS Settings" backTo="/" actions={<button className="btn primary" disabled={busy} onClick={save}>Save Settings</button>}>
      <div className="card pad">
        <div className="grid2">
          <div className="field"><label className="label">DICOM Host</label><input className="input" placeholder="e.g. 127.0.0.1" {...f("dicomHost")} />{errors.dicomHost ? <span className="error">{errors.dicomHost[0]}</span> : null}</div>
          <div className="field"><label className="label">DICOM Port</label><input className="input" type="number" {...f("dicomPort")} /></div>
          <div className="field"><label className="label">DICOM AE Title</label><input className="input" {...f("dicomAet")} /></div>
          <div className="field"><label className="label">Web URL (WADO-RS base)</label><input className="input" {...f("webUrl")} /></div>
          <div className="field"><label className="label">Username</label><input className="input" {...f("username")} /></div>
          <div className="field"><label className="label">Password</label><input className="input" type="password" {...f("password")} /></div>
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>The rebuild serves a synthetic DICOM-web layer, so the viewer works without a live node.</p>
      </div>
    </PageLayout>
  );
}
