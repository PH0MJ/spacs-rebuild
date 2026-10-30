"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session";
import { PageLayout, Pagination } from "@/components/PageLayout";
import { Icon } from "@/components/icons";

const emptyForm = { name: "", speciality: "", username: "", password: "", password_confirmation: "", isActive: true, roles: [] };

export default function UsersPage() {
  const { api, user: me, hasPermission, toast, confirm, impersonate } = useSession();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [roleNames, setRoleNames] = useState([]);
  const [modal, setModal] = useState(null);       // {mode, form, id}
  const [errors, setErrors] = useState({});
  const [tokenFor, setTokenFor] = useState(null); // {id, token}

  const load = useCallback(async (opts = {}) => {
    const p = opts.page ?? page;
    const s = opts.search ?? search;
    const st = opts.status ?? status;
    setLoading(true);
    const res = await api(`/users?search=${encodeURIComponent(s)}&status=${st}&page=${p}`);
    if (res.ok) { setItems(res.data.data || []); setMeta(res.data.meta); } else toast.danger(res.data?.message || "Failed to load users.");
    setLoading(false);
    // eslint-disable-next-line
  }, [api, page, search, status]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]);
  useEffect(() => {
    api("/roles/list").then((r) => r.ok && setRoleNames((r.data.data || []).map((x) => x.name)));
    // eslint-disable-next-line
  }, []);

  const submit = async () => {
    const f = modal.form;
    const res = modal.mode === "create"
      ? await api("/users", { method: "POST", body: f })
      : await api(`/users/${modal.id}`, { method: "PUT", body: f });
    if (res.ok) { toast.operationSuccessful(); setModal(null); setErrors({}); load(); }
    else setErrors(res.data?.errors || {});
  };

  const doImpersonate = async (u) => {
    const ok = await confirm({ title: "Impersonate User", message: `Are you sure you want to impersonate user ${u.name}? This will switch your current session.`, confirmText: "Impersonate", variant: "danger" });
    if (!ok) return;
    const res = await impersonate(u.id);
    if (res.success) { toast.success(`Now impersonating ${u.name}`); router.push("/"); }
    else toast.danger(res.error || "Impersonation failed.");
  };

  const genToken = async (u) => {
    const ok = await confirm({ title: "Generate Token", message: `Generate a new access token for ${u.name}? This will invalidate any existing access tokens.`, confirmText: "Generate Token", variant: "danger" });
    if (!ok) return;
    const res = await api(`/users/${u.id}/generate-access-token`, { method: "POST" });
    if (res.ok) { setTokenFor({ id: u.id, token: res.data.data.accessToken }); toast.operationSuccessful(); }
    else toast.danger("Failed to generate token.");
  };

  const revoke = async (u) => {
    const ok = await confirm({ title: "Revoke Tokens", message: `Revoke all active sessions for user ${u.name}?`, confirmText: "Revoke Tokens", variant: "danger" });
    if (!ok) return;
    const res = await api(`/users/${u.id}/revoke-tokens`, { method: "POST" });
    if (res.ok) toast.operationSuccessful();
  };

  const can = (p) => hasPermission(p);

  return (
    <>
      <PageLayout
        title="Users Management"
        actions={can("User.create") ? <button className="btn primary sm" onClick={() => setModal({ mode: "create", form: { ...emptyForm } })}><Icon name="plus" size={14} /> Create User</button> : null}
        filters={
          <div className="wrap" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ minWidth: 260 }}>
              <label className="label">Search</label>
              <input className="input" placeholder="Search by name or username…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setPage(1), load({ page: 1, search: e.currentTarget.value }))} />
            </div>
            <div className="field" style={{ minWidth: 180 }}>
              <label className="label">Status</label>
              <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); load({ status: e.target.value, page: 1 }); setPage(1); }}>
                <option value="">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>
        }
        footer={<Pagination meta={meta} onChange={(p) => setPage(p)} />}
      >
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Full Name</th><th>Username</th><th>Roles</th><th>Status</th>{can("User.generateAccessToken") ? <th>Access Token</th> : null}<th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="empty"><span className="spin" style={{ display: "inline-block" }} /> Loading…</td></tr>
                : items.length === 0 ? <tr><td colSpan={6} className="empty">No users found.</td></tr>
                : items.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td className="mono tiny">{u.username}</td>
                    <td><div className="wrap">{(u.roles || []).slice(0, 3).map((r) => <span key={r} className="badge">{r}</span>)}{(u.roles || []).length > 3 ? <span className="badge brand">+{u.roles.length - 3} more</span> : null}</div></td>
                    <td><span className={`badge ${u.isActive ? "success" : "danger"}`}><span className="dot" /> {u.isActive ? "Active" : "Inactive"}</span></td>
                    {can("User.generateAccessToken") ? (
                      <td>
                        {tokenFor?.id === u.id ? (
                          <span className="row"><span className="mono tiny" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{tokenFor.token}</span>
                            <button className="icon-btn" title="Copy" onClick={() => { navigator.clipboard.writeText(tokenFor.token); toast.success("Token copied to clipboard!"); }}><Icon name="copy" size={14} /></button></span>
                        ) : <span className="muted tiny">—</span>}
                      </td>
                    ) : null}
                    <td>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        {can("User.update") ? <button className="icon-btn" title="Edit" onClick={() => setModal({ mode: "edit", id: u.id, form: { ...emptyForm, ...u, password: "", password_confirmation: "" } })}><Icon name="pencil" size={14} /></button> : null}
                        {can("User.impersonate") && me?.id !== u.id ? <button className="icon-btn" title="Impersonate" onClick={() => doImpersonate(u)}><Icon name="hat" size={14} /></button> : null}
                        {can("User.generateAccessToken") ? <button className="icon-btn" title="Generate Token" onClick={() => genToken(u)}><Icon name="key" size={14} /></button> : null}
                        {can("User.revokeAllTokens") ? <button className="icon-btn" title="Revoke Tokens" onClick={() => revoke(u)}><Icon name="refresh" size={14} /></button> : null}
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
          <div className="modal lg" onClick={(e) => e.stopPropagation()}>
            <div className="between"><div className="h2">{modal.mode === "create" ? "Create User" : "Edit User"}</div><button className="icon-btn" onClick={() => setModal(null)}><Icon name="x" size={16} /></button></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              <div className="grid2">
                <div className="field"><label className="label">Full Name</label><input className="input" value={modal.form.name} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, name: e.target.value } }))} />{errors.name ? <span className="error">{errors.name[0]}</span> : null}</div>
                <div className="field"><label className="label">Speciality / Title</label><input className="input" value={modal.form.speciality} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, speciality: e.target.value } }))} /></div>
              </div>
              <div className="field"><label className="label">Username</label><input className="input" value={modal.form.username} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, username: e.target.value } }))} />{errors.username ? <span className="error">{errors.username[0]}</span> : null}</div>
              <div className="grid2">
                <div className="field"><label className="label">Password {modal.mode === "edit" ? "(leave blank to keep)" : ""}</label><input className="input" type="password" value={modal.form.password} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, password: e.target.value } }))} /></div>
                <div className="field"><label className="label">Confirm Password</label><input className="input" type="password" value={modal.form.password_confirmation} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, password_confirmation: e.target.value } }))} /></div>
              </div>
              {errors.password ? <span className="error">{errors.password[0]}</span> : null}
              <div className="field">
                <label className="label">Roles</label>
                <div className="wrap">
                  {roleNames.map((r) => (
                    <label key={r} className={`btn ${modal.form.roles.includes(r) ? "primary" : ""}`} style={{ gap: 6 }}>
                      <input type="checkbox" checked={modal.form.roles.includes(r)} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, roles: e.target.checked ? [...m.form.roles, r] : m.form.roles.filter((x) => x !== r) } }))} style={{ display: "none" }} />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
              <label className="row small"><input type="checkbox" checked={modal.form.isActive} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, isActive: e.target.checked } }))} /> Active</label>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn primary" onClick={submit}>{modal.mode === "create" ? "Create User" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
