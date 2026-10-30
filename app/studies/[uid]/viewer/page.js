"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/components/session";
import { ViewportCanvas } from "@/components/ViewportCanvas";
import { Icon } from "@/components/icons";

const PRESETS = [
  { name: "Default", ww: null, wl: null, brightness: 100, contrast: 100 },
  { name: "Soft Tissue", ww: 350, wl: 40, brightness: 120, contrast: 120 },
  { name: "Lung", ww: 1600, wl: -600, brightness: 70, contrast: 70 },
  { name: "Bone", ww: 2000, wl: 450, brightness: 160, contrast: 150 },
  { name: "Brain", ww: 80, wl: 40, brightness: 80, contrast: 170 },
];
const LAYOUTS = ["1x1", "1x2", "2x1", "2x2"];
const TOOLS = [
  { id: "wl", name: "Window/Level" }, { id: "zoom", name: "Zoom" }, { id: "pan", name: "Pan" },
  { id: "scroll", name: "Stack Scroll" }, { id: "crosshairs", name: "Crosshairs" },
];
const MEAS = [
  { id: "length", name: "Length / Distance" }, { id: "angle", name: "Angle" },
  { id: "ellipse", name: "Ellipse (Area)" }, { id: "rectangle", name: "Rectangle (Area)" },
];
const enc = encodeURIComponent;

export default function ViewerPage() {
  const { uid } = useParams();
  const router = useRouter();
  const { api, token, toast, confirm } = useSession();
  const studyUid = decodeURIComponent(uid);

  const [study, setStudy] = useState(null);
  const [series, setSeries] = useState([]);
  const [activeSeries, setActiveSeries] = useState(0);
  const [frames, setFrames] = useState([]);       // [{inst, frame}]
  const [frameIdx, setFrameIdx] = useState(0);
  const [fps, setFps] = useState(12);
  const [playing, setPlaying] = useState(false);
  const [tool, setTool] = useState("wl");
  const [layout, setLayout] = useState("1x1");
  const [linked, setLinked] = useState(true);
  const [mpr, setMpr] = useState(false);
  const [presetIdx, setPresetIdx] = useState(0);
  const [activeVp, setActiveVp] = useState(0);
  const [measurements, setMeasurements] = useState({});
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0, rot: 0, flipH: false, flipV: false, invert: false, brightness: 100, contrast: 100 });
  const playRef = useRef(null);

  // load study + series
  useEffect(() => {
    (async () => {
      const r = await api(`/studies/${enc(studyUid)}`);
      if (r.ok) setStudy(r.data.data);
      const s = await api(`/dicom-web/studies/${enc(studyUid)}/series`);
      if (s.ok && Array.isArray(s.data)) setSeries(s.data);
    })();
    // eslint-disable-next-line
  }, [studyUid]);

  // load frames for active series
  useEffect(() => {
    if (!series[activeSeries]) return;
    const s = series[activeSeries];
    (async () => {
      const r = await api(`/dicom-web/studies/${enc(studyUid)}/series/${enc(s.seriesInstanceUID)}/metadata`);
      const instances = r.ok ? (r.data.data || r.data || []) : [];
      const list = [];
      for (const inst of instances) {
        const n = inst.numberOfFrames || 1;
        for (let f = 1; f <= n; f++) list.push({ inst: inst.sopInstanceUID, frame: f });
      }
      setFrames(list);
      setFrameIdx(0);
    })();
    // eslint-disable-next-line
  }, [series, activeSeries, studyUid]);

  // cine
  useEffect(() => {
    if (playRef.current) clearInterval(playRef.current);
    if (playing && frames.length > 1) {
      playRef.current = setInterval(() => setFrameIdx((i) => (i + 1) % frames.length), Math.max(60, 1000 / fps));
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, fps, frames.length]);

  const frameUrl = useMemo(() => {
    const cur = frames[frameIdx];
    const s = series[activeSeries];
    if (!cur || !s || !token) return null;
    return `/api/dicom-web/studies/${enc(studyUid)}/series/${enc(s.seriesInstanceUID)}/instances/${enc(cur.inst)}/frames/${cur.frame}?token=${enc(token)}`;
    // eslint-disable-next-line
  }, [frames, frameIdx, series, activeSeries, studyUid, token]);

  const thumbUrl = (seriesUID) => `/api/dicom-web/studies/${enc(studyUid)}/series/${enc(seriesUID)}/instances/${enc(seriesUID + ".1")}/frames/1/rendered?token=${enc(token || "")}`;

  const applyPreset = (i) => { setPresetIdx(i); const p = PRESETS[i]; setView((v) => ({ ...v, brightness: p.brightness, contrast: p.contrast })); };
  const stepFrame = (d) => setFrameIdx((i) => Math.max(0, Math.min(frames.length - 1, i + d)));
  const setVp = (f) => (v) => setView((p) => ({ ...p, ...f }));

  const vpCount = layout === "2x2" ? 4 : layout === "1x1" ? 1 : 2;
  const gridStyle = layout === "1x1" ? { gridTemplateColumns: "1fr" }
    : layout === "1x2" ? { gridTemplateColumns: "1fr 1fr" }
    : layout === "2x1" ? { gridTemplateRows: "1fr 1fr" }
    : { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" };

  return (
    <div className="viewer">
      {/* header */}
      <div className="vtoolbar" style={{ gap: 8 }}>
        <Link href="/studies" className="vtool" title="Back to Studies"><Icon name="arrowLeft" size={14} /> Back</Link>
        {study ? (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{study.patientName} <span style={{ color: "#94a3b8", fontWeight: 400 }}>• {study.patientId}</span></span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{study.age} • {study.gender} • {study.studyDescription} • {study.studyDate}</span>
          </div>
        ) : <span className="vtool">Loading patient…</span>}
        <div className="spacer" />
        <select className="vtool" value={presetIdx} onChange={(e) => applyPreset(Number(e.target.value))} title="Window preset">
          {PRESETS.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
        </select>
        <button className={`vtool ${view.invert ? "active" : ""}`} onClick={() => setVp({ invert: !view.invert })} title="Invert Colors"><Icon name="contrast" size={14} /> Invert</button>
        <button className="vtool" onClick={() => setVp({ rot: (view.rot + 90) % 360 })} title="Rotate 90°"><Icon name="rotate" size={14} /> Rotate</button>
        <button className="vtool" onClick={() => setVp({ flipH: !view.flipH })} title="Flip Horizontal"><Icon name="flip" size={14} /> Flip H</button>
        <button className="vtool" onClick={() => setVp({ flipV: !view.flipV })} title="Flip Vertical"><Icon name="flip" size={14} /> Flip V</button>
        <button className="vtool" onClick={() => setView({ zoom: 1, panX: 0, panY: 0, rot: 0, flipH: false, flipV: false, invert: false, brightness: 100, contrast: 100 })} title="Reset View"><Icon name="refresh" size={14} /> Reset</button>
      </div>

      {/* toolbar row 2 */}
      <div className="vtoolbar">
        {TOOLS.filter((t) => t.id !== "crosshairs" || mpr).map((t) => (
          <button key={t.id} className={`vtool ${tool === t.id ? "active" : ""}`} onClick={() => setTool(t.id)}>{t.name}</button>
        ))}
        <div style={{ width: 1, height: 22, background: "#1e293b" }} />
        {MEAS.map((t) => (
          <button key={t.id} className={`vtool ${tool === t.id ? "active" : ""}`} onClick={() => setTool(t.id)}>{t.name}</button>
        ))}
        <button className="vtool" onClick={() => setMeasurements({})} title="Clear All">Clear All</button>
        <div className="spacer" />
        {frames.length > 1 ? (
          <>
            <button className={`vtool ${playing ? "active" : ""}`} onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : <><Icon name="play" size={13} /> Cine</>}</button>
            <input type="range" min="4" max="30" value={fps} onChange={(e) => setFps(Number(e.target.value))} title="FPS" style={{ accentColor: "var(--brand)" }} />
            <span className="vtool" style={{ background: "transparent", border: 0 }}>{fps} fps · {frameIdx + 1}/{frames.length}</span>
          </>
        ) : null}
        <div style={{ width: 1, height: 22, background: "#1e293b" }} />
        {LAYOUTS.map((l) => <button key={l} className={`vtool ${layout === l ? "active" : ""}`} disabled={mpr} onClick={() => setLayout(l)}>{l}</button>)}
        <button className={`vtool ${linked ? "active" : ""}`} onClick={() => setLinked((v) => !v)} title="Link Series">Link</button>
        <button className={`vtool ${mpr ? "active" : ""}`} onClick={() => { setMpr((v) => !v); setLayout("2x2"); setTool((t) => (mpr ? "wl" : "crosshairs")); }} title="Multiplanar Reconstruction">MPR</button>
      </div>

      <div className="viewer-body">
        <aside className="vsb">
          {series.length === 0 ? <div className="muted tiny" style={{ padding: 8 }}>No series.</div> : series.map((s, i) => (
            <div key={s.seriesInstanceUID} className={`vsb-item ${i === activeSeries ? "active" : ""}`} onClick={() => setActiveSeries(i)}>
              <img src={thumbUrl(s.seriesInstanceUID)} alt={s.seriesDescription} />
              <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700 }}>{s.seriesDescription}</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{s.modality} · {s.frameCount} img · S{s.seriesNumber}</div>
            </div>
          ))}
        </aside>

        <div className="vp-grid" style={gridStyle}>
          {Array.from({ length: vpCount }).map((_, i) => (
            <ViewportCanvas
              key={i}
              imageUrl={frameUrl}
              view={view}
              measurements={measurements[i] || []}
              activeTool={tool}
              active={activeVp === i}
              onActivate={() => setActiveVp(i)}
              onAdjust={setVp}
              onZoom={(z) => setVp({ zoom: z })}
              onFrameStep={stepFrame}
              onCommit={(m) => setMeasurements((prev) => ({ ...prev, [i]: [...(prev[i] || []), m] }))}
            />
          ))}
        </div>
      </div>

      {mpr ? (
        <div style={{ position: "absolute", insetInlineStart: "50%", transform: "translateX(-50%)", top: 8, background: "rgba(99,102,241,0.9)", padding: "3px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          MPR — Multiplanar Reconstruction
        </div>
      ) : null}
    </div>
  );
}
