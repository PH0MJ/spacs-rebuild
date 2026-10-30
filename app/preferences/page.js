"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session";
import { PageLayout } from "@/components/PageLayout";
import { Icon } from "@/components/icons";

const MODALITIES = ["CR", "CT", "DR", "DX", "MG", "MR", "NM", "PT", "RF", "US", "XA", "XD"];
const LAYOUTS = [
  { value: "sidenav", label: "Sidebar (Default)", desc: "Full sidebar with navigation labels.", icon: "sidebar" },
  { value: "compact", label: "Compact Rail", desc: "Slim icon rail maximizing screen space.", icon: "sliders" },
  { value: "topbar", label: "Topbar", desc: "Horizontal header bar along the top.", icon: "menu" },
];
const HOME_OPTIONS = [
  { value: "/", label: "Home (Welcome Dashboard)" },
  { value: "/studies", label: "Studies" },
  { value: "/users", label: "Users" },
  { value: "/roles", label: "Roles" },
  { value: "/print-templates", label: "Print Templates" },
  { value: "/settings/pacs", label: "PACS Settings" },
  { value: "/settings/portal", label: "Portal Settings" },
];

export default function PreferencesPage() {
  const { api, user, toast, updateUser } = useSession();
  const router = useRouter();
  const [pref, setPref] = useState({ modalities: [], autoRefreshPeriod: 0, navigationLayout: "sidenav", defaultHomePage: "/" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.preference) setPref({ modalities: [], autoRefreshPeriod: 0, navigationLayout: "sidenav", defaultHomePage: "/", ...user.preference });
    // eslint-disable-next-line
  }, [user]);

  const toggleMod = (m) => setPref((p) => ({ ...p, modalities: p.modalities.includes(m) ? p.modalities.filter((x) => x !== m) : [...p.modalities, m] }));

  const save = async () => {
    setBusy(true);
    const res = await api("/preferences", { method: "PUT", body: { ...pref, autoRefreshPeriod: Number(pref.autoRefreshPeriod) } });
    setBusy(false);
    if (res.ok) { toast.operationSuccessful(); if (user) updateUser({ ...user, preference: res.data.data }); }
    else toast.danger(res.data?.message || "Failed to save preferences.");
  };

  return (
    <PageLayout title="Preferences" backTo="/" actions={<button className="btn primary" disabled={busy} onClick={save}>Save Preferences</button>}>
      <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <div className="h2">Navigation Layout</div>
          <div className="muted small">Choose your preferred navigation layout across the workspace.</div>
          <div className="grid3" style={{ marginTop: 12 }}>
            {LAYOUTS.map((l) => (
              <button key={l.value} onClick={() => setPref((p) => ({ ...p, navigationLayout: l.value }))} className={`card pad`} style={{ textAlign: "start", borderColor: pref.navigationLayout === l.value ? "var(--brand)" : undefined, boxShadow: pref.navigationLayout === l.value ? "0 0 0 2px color-mix(in srgb, var(--brand) 25%, transparent)" : "none" }}>
                <div className="row"><span className={`icon-btn ${pref.navigationLayout === l.value ? "active" : ""}`}><Icon name={l.icon} size={16} /></span><span style={{ fontWeight: 700, fontSize: 13 }}>{l.label}</span></div>
                <div className="muted tiny" style={{ marginTop: 8 }}>{l.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--surface-border)", paddingTop: 18 }}>
          <div className="h2">Default Home Page</div>
          <div className="muted small">Landing page after logging in and when clicking the application logo.</div>
          <select className="select" style={{ maxWidth: 320, marginTop: 10 }} value={pref.defaultHomePage} onChange={(e) => setPref((p) => ({ ...p, defaultHomePage: e.target.value }))}>
            {HOME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div style={{ borderTop: "1px solid var(--surface-border)", paddingTop: 18 }}>
          <div className="h2">Active Modalities</div>
          <div className="muted small">Used as filters on the studies page.</div>
          <div className="wrap" style={{ marginTop: 10 }}>
            {MODALITIES.map((m) => (
              <label key={m} className={`btn ${pref.modalities.includes(m) ? "primary" : ""}`}>
                <input type="checkbox" style={{ display: "none" }} checked={pref.modalities.includes(m)} onChange={() => toggleMod(m)} /> {m}
              </label>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--surface-border)", paddingTop: 18 }}>
          <div className="h2">Studies Auto-Refresh</div>
          <div className="muted small">Seconds between refreshes on the studies page (0 = off, minimum 60 to enable).</div>
          <input className="input" style={{ maxWidth: 160, marginTop: 10 }} type="number" value={pref.autoRefreshPeriod} onChange={(e) => setPref((p) => ({ ...p, autoRefreshPeriod: e.target.value }))} />
        </div>
      </div>
    </PageLayout>
  );
}
