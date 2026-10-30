"use client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { PageLayout } from "@/components/PageLayout";
import { Icon } from "@/components/icons";
import { renderTemplate, buildVars } from "@/lib/report";

const VARIABLES = [
  "patientName", "patientId", "age", "gender", "studyDate", "studyTime",
  "studyDescription", "modality", "accessionNumber", "userName", "userSpeciality", "reportDate", "currentDate",
];
const emptyForm = { name: "", header: "", footer: "", includePortalQr: true, isDefault: false, userId: "" };

export default function PrintTemplatesPage() {
  const { api, user, hasPermission, toast, confirm } = useSession();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);

  const load = useCallback(async (opts = {}) => {
    setLoading(true);
    const res = await api(`/print-templates?search=${encodeURIComponent(opts.search ?? search)}&user=${opts.user ?? userFilter}`);
    if (res.ok) setItems(res.data.data || []); else toast.danger("Failed to load print templates.");
    setLoading(false);
    // eslint-disable-next-line
  }, [api, search, userFilter]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userFilter]);
  useEffect(() => { api("/users/list").then((r) => r.ok && setUsers(r.data.data || [])); /* eslint-disable-next-line */ }, []);

  const canCreate = hasPermission("PrintTemplate.createAny") || hasPermission("PrintTemplate.createOwn");
  const canUpdate = (t) => hasPermission("PrintTemplate.updateAny") || (hasPermission("PrintTemplate.updateOwn") && t.userId === user?.id);
  const canDelete = (t) => hasPermission("PrintTemplate.deleteAny") || (hasPermission("PrintTemplate.deleteOwn") && t.userId === user?.id);
  const configured = (h) => !!h && (h.replace(/<[^>]*>/g, "").trim().length > 0 || /<(img|table|hr)/i.test(h));

  const submit = async () => {
    const body = { ...modal.form, userId: modal.form.userId || null };
    const res = modal.mode === "create"
      ? await api("/print-templates", { method: "POST", body })
      : await api(`/print-templates/${modal.id}`, { method: "POST", body });
    if (res.ok) { toast.success(modal.mode === "create" ? "Print template created." : "Print template saved."); setModal(null); load(); }
    else toast.danger(res.data?.message || "Failed to save.");
  };

  const remove = async (t) => {
    const ok = await confirm({ title: "Delete Print Template", message: `Delete the print template "${t.name}"?`, confirmText: "Delete Template", variant: "danger" });
    if (!ok) return;
    const res = await api(`/print-templates/${t.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Print template deleted successfully."); load(); }
  };

  const insertVar = (field, v) => setModal((m) => ({ ...m, form: { ...m.form, [field]: `${m.form[field]}{{ ${v} }}` } }));
  const vars = buildVars({ patientName: "John Doe", patientId: "PID-2026-8941", age: "45Y", gender: "Male", studyDate: "2026-09-26", studyTime: "14:30", studyDescription: "CT Brain", modality: "CT" }, user);

  return (
    <>
      <PageLayout
        title="Print Templates"
        actions={canCreate ? <button className="btn primary sm" onClick={() => setModal({ mode: "create", form: { ...emptyForm } })}><Icon name="plus" size={14} /> Create Print Template</button> : null}
        filters={
          <div className="wrap" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ minWidth: 240 }}><label className="label">Search</label><input className="input" placeholder="Search print templates…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => load({ search: e.currentTarget.value })} /></div>
            {hasPermission("PrintTemplate.listAny") ? (
              <div className="field" style={{ minWidth: 220 }}>
                <label className="label">Filter by user</label>
                <select className="select" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
                  <option value="all">All Templates</option>
                  <option value="system">System (Global)</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            ) : null}
          </div>
        }
      >
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Template Name</th><th>User</th><th>Header</th><th>Footer</th><th>Portal QR</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="empty"><span className="spin" style={{ display: "inline-block" }} /> Loading…</td></tr>
                : items.length === 0 ? <tr><td colSpan={6} className="empty">No print templates found.</td></tr>
                : items.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.name} {t.isDefault ? <span className="badge brand">Default</span> : null}</td>
                    <td>{t.userId ? <span className="badge">{t.user?.name || t.userId}</span> : <span className="badge primary">System (Global)</span>}</td>
                    <td>{configured(t.header) ? <span className="badge success">Configured</span> : <span className="muted">—</span>}</td>
                    <td>{configured(t.footer) ? <span className="badge success">Configured</span> : <span className="muted">—</span>}</td>
                    <td>{t.includePortalQr ? <span className="badge success">Included</span> : <span className="muted small">Excluded</span>}</td>
                    <td>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        {canUpdate(t) ? <button className="icon-btn" title="Edit" onClick={() => setModal({ mode: "edit", id: t.id, form: { name: t.name, header: t.header, footer: t.footer, includePortalQr: t.includePortalQr, isDefault: t.isDefault, userId: t.userId || "" } })}><Icon name="pencil" size={14} /></button> : null}
                        {canDelete(t) ? <button className="icon-btn" title="Delete" onClick={() => remove(t)}><Icon name="trash" size={14} /></button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </PageLayout>

      {modal ? (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal xl" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "92vh", overflowY: "auto" }}>
            <div className="between"><div className="h2">{modal.mode === "create" ? "Create Print Template" : "Edit Print Template"}</div><button className="icon-btn" onClick={() => setModal(null)}><Icon name="x" size={16} /></button></div>
            <div className="grid2" style={{ marginTop: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="field"><label className="label">Template Name</label><input className="input" value={modal.form.name} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, name: e.target.value } }))} /></div>
                <div className="field">
                  <label className="label">Header HTML</label>
                  <textarea className="textarea" value={modal.form.header} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, header: e.target.value } }))} />
                  <div className="wrap">{VARIABLES.slice(0, 8).map((v) => <button key={v} className="btn sm ghost" onClick={() => insertVar("header", v)}>{`{{ ${v} }}`}</button>)}</div>
                </div>
                <div className="field">
                  <label className="label">Footer HTML</label>
                  <textarea className="textarea" value={modal.form.footer} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, footer: e.target.value } }))} />
                  <div className="wrap">{["userName", "userSpeciality", "reportDate", "currentDate"].map((v) => <button key={v} className="btn sm ghost" onClick={() => insertVar("footer", v)}>{`{{ ${v} }}`}</button>)}</div>
                </div>
                <div className="wrap">
                  <label className="row small"><input type="checkbox" checked={modal.form.includePortalQr} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, includePortalQr: e.target.checked } }))} /> Include portal QR</label>
                  <label className="row small"><input type="checkbox" checked={modal.form.isDefault} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, isDefault: e.target.checked } }))} /> Default template</label>
                </div>
                {hasPermission("PrintTemplate.createAny") ? (
                  <div className="field"><label className="label">Assign to user (blank = System/Global)</label>
                    <select className="select" value={modal.form.userId} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, userId: e.target.value } }))}>
                      <option value="">System (Global)</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                ) : null}
              </div>
              <div>
                <div className="label">Live Preview</div>
                <div className="card pad" style={{ marginTop: 8, background: "#fff", color: "#111", minHeight: 420 }}>
                  <div className="report-header" style={{ borderBottom: "1px dashed #cbd5e1", paddingBottom: 8 }} dangerouslySetInnerHTML={{ __html: renderTemplate(modal.form.header, vars) || '<span class="muted">Header is empty.</span>' }} />
                  <div style={{ padding: "16px 0" }}>
                    <h4 style={{ fontWeight: 800 }}>Clinical Report Body (Sample Preview)</h4>
                    <p className="small muted">Findings: No evidence of acute intracranial hemorrhage, mass effect, edema, or midline shift.</p>
                    <p className="small muted">Impression: Unremarkable non-contrast head CT.</p>
                  </div>
                  {modal.form.includePortalQr ? <div style={{ textAlign: "right" }}><Icon name="qr" size={40} /></div> : null}
                  <div className="report-footer" style={{ borderTop: "1px dashed #cbd5e1", paddingTop: 8 }} dangerouslySetInnerHTML={{ __html: renderTemplate(modal.form.footer, vars) || '<span class="muted">Footer is empty.</span>' }} />
                </div>
              </div>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn primary" onClick={submit}>Save Template</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
