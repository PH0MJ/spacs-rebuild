"use client";
import Link from "next/link";
import { Icon } from "./icons";

export function PageLayout({ title, backTo, actions, filters, footer, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="between" style={{ flexWrap: "wrap" }}>
        <div className="row">
          {backTo ? (
            <Link href={backTo} className="icon-btn" title="Back"><Icon name="arrowLeft" /></Link>
          ) : null}
          <div className="h1">{title}</div>
        </div>
        <div className="row">{actions}</div>
      </div>
      {filters ? <div className="card pad">{filters}</div> : null}
      {children}
      {footer}
    </div>
  );
}

export function Pagination({ meta, onChange }) {
  if (!meta) return null;
  const { current_page, last_page, total, per_page } = meta;
  const from = total === 0 ? 0 : (current_page - 1) * per_page + 1;
  const to = Math.min(current_page * per_page, total);
  return (
    <div className="between" style={{ marginTop: 12 }}>
      <span className="muted small">Showing {from} to {to} of {total} entries</span>
      <div className="row">
        <button className="btn sm" disabled={current_page <= 1} onClick={() => onChange(current_page - 1)}>Prev</button>
        <span className="small muted">Page {current_page} / {last_page}</span>
        <button className="btn sm" disabled={current_page >= last_page} onClick={() => onChange(current_page + 1)}>Next</button>
      </div>
    </div>
  );
}
