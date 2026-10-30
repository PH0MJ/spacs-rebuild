"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/session";
import { PageLayout, Pagination } from "@/components/PageLayout";
import { Icon } from "@/components/icons";
import { ShareStudyDialog } from "@/components/ShareStudyDialog";

const MODALITIES = ["DX", "CT", "MG", "MR", "XA", "CR", "DR", "NM", "XD", "PT", "US", "RF"];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function statusBadge(report) {
  if (!report) return <span className="badge">Write</span>;
  if (report.status === "final") return <span className="badge success"><Icon name="check" size={11} /> Final</span>;
  if (report.status === "amended") return <span className="badge primary">Amended</span>;
  return <span className="badge warning">Draft</span>;
}

export default function StudiesPage() {
  const { api, user, hasPermission, toast } = useSession();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ patientId: "", patientName: "", modality: "all", studyDate: `${todayISO()},${todayISO()}` });
  const [shareUid, setShareUid] = useState(null);
  const timer = useRef(null);
  const canViewReport = hasPermission("Report.view");

  const buildQuery = useCallback((f, page = 1) => {
    const q = new URLSearchParams();
    q.set("patientId", f.patientId || "");
    q.set("patientName", f.patientName || "");
    q.set("modality", f.modality === "all" ? "" : f.modality);
    q.set("studyDate", f.studyDate || "");
    q.set("page", String(page));
    return q.toString();
  }, []);

  const load = useCallback(async (f, { silent = false } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError("");
    const res = await api(`/studies?${buildQuery(f)}`);
    if (res.ok && res.data) { setItems(res.data.data || []); setMeta(res.data.meta); }
    else { setItems([]); setError(res.data?.message || "Unable to load studies"); }
    setLoading(false); setRefreshing(false);
  }, [api, buildQuery]);

  useEffect(() => { load(filters); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const period = user?.preference?.autoRefreshPeriod ?? 0;
    if (timer.current) clearInterval(timer.current);
    if (period >= 60) timer.current = setInterval(() => load(filters, { silent: true }), period * 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line
  }, [user?.preference?.autoRefreshPeriod, filters, load]);

  const apply = (patch) => { const next = { ...filters, ...patch }; setFilters(next); load(next); };
  const modalities = user?.preference?.modalities?.length ? user.preference.modalities : MODALITIES;

  return (
    <>
      <PageLayout
        title="Studies"
        actions={
          <>
            {refreshing ? <span className="row muted tiny"><span className="spin" /> Refreshing…</span> : null}
            <button className="btn sm" disabled={loading} onClick={() => load(filters)}><Icon name="refresh" size={14} /> Refresh</button>
          </>
        }
        filters={
          <div className="wrap" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ minWidth: 160 }}>
              <label className="label">Patient ID</label>
              <input className="input" value={filters.patientId} placeholder="Search Patient ID…" onChange={(e) => setFilters((f) => ({ ...f, patientId: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && apply({})} />
            </div>
            <div className="field" style={{ minWidth: 160 }}>
              <label className="label">Patient Name</label>
              <input className="input" value={filters.patientName} placeholder="Search Patient Name…" onChange={(e) => setFilters((f) => ({ ...f, patientName: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && apply({})} />
            </div>
            <div className="field" style={{ minWidth: 150 }}>
              <label className="label">Modality</label>
              <select className="select" value={filters.modality} onChange={(e) => apply({ modality: e.target.value })}>
                <option value="all">All Modalities</option>
                {modalities.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="field" style={{ minWidth: 240 }}>
              <label className="label">Study Date (from,to)</label>
              <div className="row">
                <input className="input" type="date" value={filters.studyDate.split(",")[0] || ""} onChange={(e) => apply({ studyDate: `${e.target.value},${(filters.studyDate.split(",")[1] || "")}` })} />
                <input className="input" type="date" value={filters.studyDate.split(",")[1] || ""} onChange={(e) => apply({ studyDate: `${(filters.studyDate.split(",")[0] || "")},${e.target.value}` })} />
              </div>
            </div>
            <button className="btn" onClick={() => apply({ patientId: "", patientName: "", modality: "all", studyDate: "" })}>Clear</button>
          </div>
        }
        footer={<Pagination meta={meta} onChange={(page) => load(filters, { silent: false })} />}
      >
        {error ? <div className="card pad" style={{ borderColor: "var(--danger)" }}>{error}</div> : null}
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Patient ID</th><th>Patient Name</th><th>Age</th><th>Gender</th><th>Modality</th>
                <th>Study Description</th><th>Study Date</th><th>Study Time</th><th>Report</th><th>Viewers</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="empty"><span className="spin" style={{ display: "inline-block" }} /> Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={11} className="empty">No studies found.</td></tr>
              ) : items.map((s) => (
                <tr key={s.studyInstanceUid}>
                  <td className="mono tiny">{s.patientId}</td>
                  <td style={{ fontWeight: 600 }}>{s.patientName}</td>
                  <td>{s.age}</td>
                  <td>{s.gender}</td>
                  <td><span className="badge brand">{s.modality}</span></td>
                  <td className="muted">{s.studyDescription}</td>
                  <td>{s.studyDate}</td>
                  <td>{s.studyTime}</td>
                  <td>
                    {canViewReport ? <Link href={`/studies/${encodeURIComponent(s.studyInstanceUid)}/report`}>{statusBadge(s.report)}</Link> : statusBadge(s.report)}
                  </td>
                  <td>
                    <Link className="btn sm" href={`/studies/${encodeURIComponent(s.studyInstanceUid)}/viewer`}><Icon name="eye" size={13} /> Web</Link>
                  </td>
                  <td>
                    {hasPermission("StudyShare.create") ? (
                      <button className="icon-btn" title="Share" onClick={() => setShareUid(s.studyInstanceUid)}><Icon name="share" size={15} /></button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageLayout>
      <ShareStudyDialog open={!!shareUid} studyInstanceUid={shareUid} onClose={() => setShareUid(null)} />
    </>
  );
}
