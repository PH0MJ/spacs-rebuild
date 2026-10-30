"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/session";
import { PageLayout, Pagination } from "@/components/PageLayout";
import { Icon } from "@/components/icons";

function humanize(p) { return p.replace(/([A-Z])/g, " $1").trim(); }

export default function RolesPage() {
  const { api, hasPermission, toast, confirm } = useSession();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [allPerms, setAllPerms] = useState([]);
  const [modal, setModal] = useState(null);
  const [errors, setErrors] = useState({});

  const load = useCallback(async (opts = {}) => {
    setLoading(true);
    const res = await api(`/roles?search=${encodeURIComponent(opts.search ?? search)}&page=${opts.page ?? page}`);
    if (res.ok) { setItems(res.data.data || []); setMeta(res.data.meta); } else toast.danger("Failed to load roles.");
    setLoading(false);
    // eslint-disable-next-line
  }, [api, search, page]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]);
  useEffect(() => { api("/permissions").then((r) => r.ok && setAllPerms(r.data || [])); /* eslint-disable-next-line */ }, []);

  const grouped = useMemo(() => {
    const g = {};
    for (const p of allPerms) { const res = p.split(".")[0] || "General"; (g[res] = g[res] || []).push(p); }
    return g;
  }, [allPerms]);

  const submit = async () => {
    const res = modal.mode === "create"
      ? await api("/roles", { method: "POST", body: { name: modal.name, permissions: modal.permissions } })
      : await api(`/roles/${modal.id}`, { method: "PUT", body: { name: modal.name, permissions: modal.permissions } });
    if (res.ok) { toast.operationSuccessful(); setModal(null); setErrors({}); load(); }
    else setErrors(res.data?.errors || {});
  };

  const remove = async (r) => {
    const ok = await confirm({ title: "Delete Role", message: `Delete the role ${r.name}?`, confirmText: "Delete Role", variant: "danger" });
    if (!ok) return;
    const res = await api(`/roles/${r.id}`, { method: "DELETE" });
    if (res.ok) { toast.operationSuccessful(); load(); }
  };

  const togglePerm = (p) => setModal((m) => ({ ...m, permissions: m.permissions.includes(p) ? m.permissions.filter((x) => x !== p) : [...m.permissions, p] }));
  const toggleGroup = (res) => setModal((m) => {
    const list = grouped[res] || [];
    const hasAll = list.every((p) => m.permissions.includes(p));
    return { ...m, permissions: hasAll ? m.permissions.filter((p) => !list.includes(p)) : [...new Set([...m.permissions, ...list])] };
  });

  return (
    <>
      <PageLayout
        title="Roles & Permissions"
        actions={hasPermission("Role.create") ? <button className="btn primary sm" onClick={() => setModal({ mode: "create", name: "", permissions: [] })}><Icon name="plus" size={14} /> Create Role</button> : null}
        filters={<div className="field" style={{ maxWidth: 320 }}><label className="label">Search</label><input className="input" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { setPage(1); load({ page: 1, search: e.currentTarget.value }); }} /></div>}
        footer={<Pagination meta={meta} onChange={(p) => setPage(p)} />}
      >
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Role Name</th><th>Users</th><th>Permissions</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="empty"><span className="spin" style={{ display: "inline-block" }} /> Loading…</td></tr>
                : items.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name} {r.isSystem ? <span className="badge">system</span> : null}</td>
                    <td><span className="badge brand">{r.usersCount}</span></td>
                    <td><div className="wrap">{r.permissions.slice(0, 6).map((p) => <span key={p} className="badge tiny">{p}</span>)}{r.permissions.length > 6 ? <span className="badge">+{r.permissions.length - 6} more</span> : null}</div></td>
                    <td>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        {hasPermission("Role.update") ? <button className="icon-btn" title="Edit" onClick={() => setModal({ mode: "edit", id: r.id, name: r.name, permissions: [...r.permissions] })}><Icon name="pencil" size={14} /></button> : null}
                        {hasPermission("Role.delete") && !r.isSystem ? <button className="icon-btn" title="Delete" onClick={() => remove(r)}><Icon name="trash" size={14} /></button> : null}
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
          <div className="modal xl" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="between"><div className="h2">{modal.mode === "create" ? "Create Role" : "Edit Role"}</div><button className="icon-btn" onClick={() => setModal(null)}><Icon name="x" size={16} /></button></div>
            <div className="field" style={{ marginTop: 14, maxWidth: 320 }}><label className="label">Role Name</label><input className="input" value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} />{errors.name ? <span className="error">{errors.name[0]}</span> : null}</div>
            <div className="label" style={{ marginTop: 14 }}>Assign Permissions</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
              {Object.entries(grouped).map(([res, list]) => {
                const hasAll = list.every((p) => modal.permissions.includes(p));
                return (
                  <div key={res} className="card pad">
                    <div className="between" style={{ borderBottom: "1px solid var(--surface-border)", paddingBottom: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase" }}>{humanize(res)}</span>
                      <button className="btn sm ghost" onClick={() => toggleGroup(res)}>{hasAll ? "Unselect All" : "Select All"}</button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                      {list.map((p) => (
                        <label key={p} className="row small"><input type="checkbox" checked={modal.permissions.includes(p)} onChange={() => togglePerm(p)} /> {humanize(p.split(".").slice(1).join("."))}</label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn primary" onClick={submit}>{modal.mode === "create" ? "Create Role" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
