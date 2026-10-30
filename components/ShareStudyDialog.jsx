"use client";
import { useState } from "react";
import { useSession } from "./session";
import { Icon } from "./icons";

const OPTIONS = [
  { value: "1day", label: "1 Day" },
  { value: "7days", label: "7 Days" },
  { value: "30days", label: "30 Days" },
  { value: "never", label: "Never Expire" },
];

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function ShareStudyDialog({ open, studyInstanceUid, onClose }) {
  const { api, toast } = useSession();
  const [expiry, setExpiry] = useState("7days");
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  async function generate() {
    setBusy(true);
    const expiresAt = expiry === "never" ? null : expiry === "1day" ? addDays(1) : expiry === "7days" ? addDays(7) : addDays(30);
    const res = await api("/study-shares", { method: "POST", body: { studyInstanceUid, expiresAt } });
    if (res.ok) {
      const shareLink = res.data.data.shareLink;
      setLink(shareLink);
      try {
        const QR = (await import("qrcode")).default;
        setQr(await QR.toDataURL(shareLink, { width: 600, margin: 1 }));
      } catch { setQr(""); }
      toast.success("Share link generated.");
    } else {
      toast.danger(res.data?.message || "Failed to create share link.");
    }
    setBusy(false);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal lg" onClick={(e) => e.stopPropagation()}>
        <div className="between">
          <div className="row"><Icon name="share" size={16} /><div className="h2">Share Study</div></div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        {!link ? (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="label">Link Expiration</div>
            <div className="wrap">
              {OPTIONS.map((o) => (
                <button key={o.value} className={`btn ${expiry === o.value ? "primary" : ""}`} onClick={() => setExpiry(o.value)}>{o.label}</button>
              ))}
            </div>
            <button className="btn primary" disabled={busy} onClick={generate} style={{ alignSelf: "flex-start" }}>
              {busy ? <span className="spin" /> : <Icon name="qr" size={15} />} Generate Share Link
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            {qr ? <img src={qr} alt="QR" width={220} height={220} style={{ background: "#fff", borderRadius: 10, padding: 8 }} /> : null}
            <div className="row" style={{ width: "100%" }}>
              <input className="input mono" readOnly value={link} />
              <button className="btn" onClick={copy}>{copied ? <Icon name="check" size={15} /> : <Icon name="copy" size={15} />} {copied ? "Copied" : "Copy"}</button>
              <button className="btn" onClick={() => { const w = window.open("", "_blank"); if (w) { w.document.write(`<h2>sPACS — Study Share</h2><img src="${qr}" width="300"/><p>${link}</p>`); w.document.close(); } }}>
                <Icon name="printer" size={15} /> Print QR
              </button>
            </div>
            <p className="muted small">Anyone with this link can open a scoped guest viewer for this study (expiry: {expiry}).</p>
          </div>
        )}
      </div>
    </div>
  );
}
