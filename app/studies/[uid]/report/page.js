"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/components/session";
import { Icon } from "@/components/icons";
import { decodeReport, encodeReport, renderTemplate, buildVars } from "@/lib/report";

function Editable({ html, onChange, className, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== (html || "")) el.innerHTML = html || "";
    // eslint-disable-next-line
  }, [html]);
  return (
    <div ref={ref} className={className} style={style} contentEditable suppressContentEditableWarning
      onInput={(e) => onChange(e.currentTarget.innerHTML)} />
  );
}

function statusBadge(status) {
  if (status === "final") return <span className="badge success"><Icon name="check" size={11} /> Final</span>;
  if (status === "amended") return <span className="badge primary">Amended</span>;
  return <span className="badge warning">Draft</span>;
}

export default function ReportPage() {
  const { uid } = useParams();
  const router = useRouter();
  const { api, user, hasPermission, toast, confirm } = useSession();
  const studyUid = decodeURIComponent(uid);

  const [study, setStudy] = useState(null);
  const [report, setReport] = useState(null);
  const [share, setShare] = useState(null);
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [pages, setPages] = useState([""]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [printTemplates, setPrintTemplates] = useState([]);
  const [selectedPrint, setSelectedPrint] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [editing, setEditing] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await api(`/studies/${encodeURIComponent(studyUid)}`);
      if (s.ok) setStudy(s.data.data);
      const r = await api(`/studies/${encodeURIComponent(studyUid)}/report`);
      if (r.ok && r.data.data) {
        const rep = r.data.data;
        setReport(rep);
        const doc = decodeReport(rep.content || "");
        setHeader(doc.header); setFooter(doc.footer); setPages(doc.bodyPages.length ? doc.bodyPages : [""]);
        setShare(r.data.share || rep.studyShare || null);
      }
      const pt = await api("/print-templates");
      if (pt.ok) {
        setPrintTemplates(pt.data.data || []);
        const def = (pt.data.data || []).find((t) => t.isDefault);
        if (def) setSelectedPrint(def.id);
      }
    })();
    // eslint-disable-next-line
  }, [studyUid]);

  const isAuthor = report?.author?.id && user?.id && report.author.id === user.id;
  const canUpdate = hasPermission("Report.updateAny") || (hasPermission("Report.updateOwn") && isAuthor) || hasPermission("Report.create");
  const canFinalize = hasPermission("Report.finalize") && canUpdate;

  const contentNow = () => encodeReport({ header, bodyPages: pages, footer });
  const mark = () => setDirty(true);

  const saveDraft = useCallback(async () => {
    setBusy(true);
    const res = await api(`/studies/${encodeURIComponent(studyUid)}/reports/draft`, { method: "POST", body: { content: contentNow() } });
    setBusy(false);
    if (res.ok) { setReport(res.data.data); setShare(res.data.share || res.data.data?.studyShare || null); setDirty(false); toast.operationSuccessful(); }
    else toast.danger(res.data?.message || "Failed to save draft.");
    // eslint-disable-next-line
  }, [api, studyUid, header, pages, footer]);

  const finalize = useCallback(async () => {
    if (!pages.join("").replace(/<[^>]*>/g, "").trim()) { toast.warning("Report content cannot be empty when finalizing."); return; }
    const ok = await confirm({ title: "Finalize Report", message: "Are you sure you want to sign and finalize this report? Once finalized, further edits will require an amendment log.", confirmText: "Sign & Finalize", variant: "brand" });
    if (!ok) return;
    setBusy(true);
    const res = await api(`/studies/${encodeURIComponent(studyUid)}/reports/finalize`, { method: "POST", body: { content: contentNow() } });
    setBusy(false);
    if (res.ok) { setReport(res.data.data); setShare(res.data.share || res.data.data?.studyShare || null); setDirty(false); setEditing(false); toast.operationSuccessful(); }
    else toast.danger(res.data?.message || "Failed to finalize report.");
    // eslint-disable-next-line
  }, [api, studyUid, header, pages, footer]);

  const amend = useCallback(async () => {
    const reason = window.prompt("Amendment reason:");
    if (reason === null) return;
    setBusy(true);
    const res = await api(`/studies/${encodeURIComponent(studyUid)}/reports/amend`, { method: "POST", body: { content: contentNow(), revisionReason: reason } });
    setBusy(false);
    if (res.ok) { setReport(res.data.data); setDirty(false); setEditing(false); toast.operationSuccessful(); }
    else toast.danger(res.data?.message || "Failed to submit amendment.");
    // eslint-disable-next-line
  }, [api, studyUid, header, pages, footer]);

  const openHistory = async () => {
    if (!report) return;
    const res = await api(`/reports/${encodeURIComponent(report.id)}/revisions`);
    if (res.ok) setHistory(res.data.data || []);
    setShowHistory(true);
  };

  const openTemplates = async () => {
    const res = await api("/report-templates");
    if (res.ok) setTemplates(res.data.data || []);
    setShowTemplates(true);
  };

  const applyTemplate = (t) => {
    setPages([t.content]);
    mark();
    setShowTemplates(false);
    toast.success("Template applied successfully.");
  };

  const printReport = useCallback(async () => {
    const tpl = printTemplates.find((t) => t.id === selectedPrint);
    const vars = buildVars(study, user);
    const head = tpl ? renderTemplate(tpl.header, vars) : renderTemplate("<p><strong>RADIOLOGY REPORT</strong> — {{ patientName }} ({{ patientId }})</p>", vars);
    const foot = tpl ? renderTemplate(tpl.footer, vars) : renderTemplate("<p>{{ userName }} — {{ userSpeciality }} — {{ reportDate }}</p>", vars);
    let qrImg = "";
    if (!tpl || tpl.includePortalQr) {
      try {
        let link = share?.shareLink;
        if (!link) {
          const res = await api("/study-shares", { method: "POST", body: { studyInstanceUid: studyUid, expiresAt: null } });
          if (res.ok) { link = res.data.data.shareLink; setShare(res.data.data); }
        }
        if (link) {
          const QR = (await import("qrcode")).default;
          qrImg = await QR.toDataURL(link, { width: 300, margin: 1 });
        }
      } catch {}
    }
    const w = window.open("", "_blank");
    if (!w) { toast.warning("Allow pop-ups to print."); return; }
    const bodyHtml = pages.join('<div style="page-break-after:always"></div>');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Report ${study?.patientId || ""}</title>
      <style>@page{size:A4;margin:16mm}body{font-family:'Segoe UI',sans-serif;color:#111;font-size:12px}
      .report-header{border-bottom:1px solid #cbd5e1;padding-bottom:8px;margin-bottom:12px}
      .report-footer{border-top:1px solid #cbd5e1;padding-top:8px;margin-top:12px}
      .qr{text-align:right;margin-top:12px}</style></head>
      <body><div class="report-header">${head}</div><div class="report-body">${bodyHtml}</div>
      <div class="report-footer">${foot}</div>${qrImg ? `<div class="qr"><img src="${qrImg}" width="120"/></div>` : ""}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
    // eslint-disable-next-line
  }, [api, studyUid, study, user, pages, printTemplates, selectedPrint, share]);

  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") { e.preventDefault(); printReport(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [printReport]);

  return (
    <div className="shell col">
      <div className="topbar" style={{ flexWrap: "wrap" }}>
        <Link href="/studies" className="icon-btn" title="Back"><Icon name="arrowLeft" /></Link>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{study?.patientName || "Loading Patient…"} {study?.modality ? <span className="badge brand" style={{ marginInlineStart: 6 }}>{study.modality}</span> : null}</div>
          <div className="muted tiny mono">{study?.patientId} • {study?.studyDate} • {study?.studyDescription}</div>
        </div>
        <div className="spacer" />
        {statusBadge(report?.status)}
        <span className="tiny muted">{dirty ? "Unsaved changes" : busy ? "Saving…" : "All changes saved"}</span>
        {printTemplates.length ? (
          <select className="select" style={{ width: 180 }} value={selectedPrint} onChange={(e) => setSelectedPrint(e.target.value)}>
            {printTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " (Default)" : ""}</option>)}
          </select>
        ) : null}
        <button className="btn sm" onClick={openTemplates} disabled={!canUpdate}><Icon name="file" size={13} /> Templates</button>
        <button className="btn sm" onClick={printReport}><Icon name="printer" size={13} /> Print</button>
        {report && report.revisionsCount > 0 ? <button className="btn sm" onClick={openHistory}>History ({report.revisionsCount})</button> : null}
        {report?.status === "draft" && canUpdate ? (
          <>
            <button className="btn sm" disabled={busy} onClick={saveDraft}>Save Draft</button>
            {canFinalize ? <button className="btn sm primary" disabled={busy} onClick={finalize}>Sign & Finalize</button> : null}
          </>
        ) : null}
        {report && report.status !== "draft" && canUpdate ? (
          editing
            ? <button className="btn sm primary" disabled={busy} onClick={amend}>Save Amendment</button>
            : <button className="btn sm" onClick={() => setEditing(true)}>Edit / Amend</button>
        ) : null}
      </div>

      <div className="paper" style={{ flex: 1, overflowY: "auto" }}>
        <div className="sheet">
          <Editable className="report-header" html={header} onChange={(v) => { setHeader(v); mark(); }} style={{ paddingBottom: 10 }} />
          {pages.map((p, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Editable className="report-body" html={p} onChange={(v) => { setPages((arr) => arr.map((x, j) => (j === i ? v : x))); mark(); }} />
              {pages.length > 1 ? (
                <button className="btn sm" style={{ alignSelf: "flex-end" }} onClick={() => setPages((arr) => arr.filter((_, j) => j !== i))}>Remove page {i + 1}</button>
              ) : null}
              {i < pages.length - 1 ? <div className="center muted tiny">— page break —</div> : null}
            </div>
          ))}
          <button className="btn sm" onClick={() => setPages((arr) => [...arr, ""])}><Icon name="plus" size={13} /> Add Page</button>
          <Editable className="report-footer" html={footer} onChange={(v) => { setFooter(v); mark(); }} style={{ marginTop: 16 }} />
        </div>
      </div>

      {showTemplates ? (
        <div className="overlay" onClick={() => setShowTemplates(false)}>
          <div className="modal lg" onClick={(e) => e.stopPropagation()}>
            <div className="between"><div className="h2">Clinical Report Templates</div><button className="icon-btn" onClick={() => setShowTemplates(false)}><Icon name="x" size={16} /></button></div>
            <p className="muted small" style={{ marginTop: 6 }}>Select a structured template — applying it replaces the current body.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12, maxHeight: 420, overflowY: "auto" }}>
              {templates.length === 0 ? <div className="empty">No templates.</div> : templates.map((t) => (
                <div key={t.id} className="card pad between">
                  <div><div style={{ fontWeight: 700 }}>{t.name}</div><div className="muted tiny">{(t.content || "").replace(/<[^>]*>/g, "").slice(0, 90)}…</div></div>
                  <div className="row">
                    <button className="btn sm primary" onClick={() => applyTemplate(t)}>Apply</button>
                    <button className="btn sm danger" onClick={async () => { await api(`/report-templates/${t.id}`, { method: "DELETE" }); setTemplates((arr) => arr.filter((x) => x.id !== t.id)); }}><Icon name="trash" size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showHistory ? (
        <div className="overlay" onClick={() => setShowHistory(false)}>
          <div className="modal lg" onClick={(e) => e.stopPropagation()}>
            <div className="between"><div className="h2">Revision History</div><button className="icon-btn" onClick={() => setShowHistory(false)}><Icon name="x" size={16} /></button></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12, maxHeight: 460, overflowY: "auto" }}>
              {history.length === 0 ? <div className="empty">No revisions yet.</div> : history.map((h) => (
                <div key={h.id} className="card pad">
                  <div className="between"><span className="badge brand">{h.reason}</span><span className="muted tiny">{new Date(h.createdAt).toLocaleString()}</span></div>
                  <div className="muted small" style={{ marginTop: 6 }}>by {h.author}</div>
                  <div className="tiny mono" style={{ marginTop: 6, maxHeight: 90, overflow: "hidden" }}>{(h.content || "").replace(/<[^>]*>/g, "").slice(0, 200)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
