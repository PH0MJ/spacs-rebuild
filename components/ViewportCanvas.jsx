"use client";
import { useCallback, useEffect, useRef } from "react";

export function ViewportCanvas({ imageUrl, view, measurements, activeTool, active, onActivate, onCommit, onAdjust, onZoom, onFrameStep }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);
  const draftRef = useRef(null);
  const regRef = useRef(view);
  regRef.current = view;

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => { imgRef.current = img; draw(); };
    img.onerror = () => { imgRef.current = null; draw(); };
    img.src = imageUrl;
    // eslint-disable-next-line
  }, [imageUrl]);

  const base = () => {
    const c = canvasRef.current;
    const v = regRef.current;
    const iw = imgRef.current?.naturalWidth || 512;
    const ih = imgRef.current?.naturalHeight || 512;
    const cx = (c?.width || 1) / 2, cy = (c?.height || 1) / 2;
    const s0 = Math.min((c?.width || 1) / iw, (c?.height || 1) / ih) * 0.96;
    return { s0, iw, ih, cx, cy };
  };

  const toImage = (px, py) => {
    const { s0, iw, ih, cx, cy } = base();
    const v = regRef.current;
    let x = px - (cx + v.panX), y = py - (cy + v.panY);
    const r = (-v.rot * Math.PI) / 180;
    const xr = x * Math.cos(r) - y * Math.sin(r);
    const yr = x * Math.sin(r) + y * Math.cos(r);
    const sc = s0 * v.zoom;
    return { x: xr / ((v.flipH ? -1 : 1) * sc) + iw / 2, y: yr / ((v.flipV ? -1 : 1) * sc) + ih / 2 };
  };

  const toCanvas = (ix, iy) => {
    const { s0, iw, ih, cx, cy } = base();
    const v = regRef.current;
    const sc = s0 * v.zoom;
    let x = (ix - iw / 2) * (v.flipH ? -1 : 1) * sc;
    let y = (iy - ih / 2) * (v.flipV ? -1 : 1) * sc;
    const r = (v.rot * Math.PI) / 180;
    return [x * Math.cos(r) - y * Math.sin(r) + cx + v.panX, x * Math.sin(r) + y * Math.cos(r) + cy + v.panY];
  };

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const v = regRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, c.width, c.height);
    const img = imgRef.current;
    if (!img) {
      ctx.fillStyle = "#64748b"; ctx.font = "13px sans-serif"; ctx.fillText("Loading…", 12, 20);
    } else {
      const { s0, iw, ih, cx, cy } = base();
      ctx.save();
      ctx.filter = `brightness(${v.brightness}%) contrast(${v.contrast}%)${v.invert ? " invert(1)" : ""}`;
      ctx.translate(cx + v.panX, cy + v.panY);
      ctx.rotate((v.rot * Math.PI) / 180);
      ctx.scale(s0 * v.zoom * (v.flipH ? -1 : 1), s0 * v.zoom * (v.flipV ? -1 : 1));
      ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
      ctx.restore();
    }
    // overlays
    ctx.save();
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#facc15"; ctx.fillStyle = "#facc15";
    ctx.font = "12px ui-monospace, monospace";
    for (const m of [...(measurements || []), ...(draftRef.current ? [draftRef.current] : [])]) {
      const a = toCanvas(m.a.x, m.a.y), b = toCanvas(m.b.x, m.b.y);
      if (m.type === "length" || m.type === "angle") {
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        for (const p of [a, b]) { ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill(); }
        const label = m.type === "length" ? `${Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y).toFixed(1)} px` : `${lineAngle(m).toFixed(1)}°`;
        ctx.fillText(label, b[0] + 8, b[1] - 4);
      } else {
        const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]);
        const w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]);
        ctx.beginPath();
        if (m.type === "ellipse") ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        else ctx.rect(x, y, w, h);
        ctx.stroke();
        ctx.fillText(`${(w * h / 100).toFixed(0)} cm²`, x + 4, y > 16 ? y - 4 : y + 15);
      }
    }
    ctx.restore();
    // eslint-disable-next-line
  }, [measurements]);

  useEffect(() => { draw(); }, [draw, view]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const parent = c.parentElement;
    const resize = () => { const r = parent.getBoundingClientRect(); c.width = Math.max(1, Math.floor(r.width)); c.height = Math.max(1, Math.floor(r.height)); draw(); };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [draw]);

  const isMeasure = ["length", "angle", "ellipse", "rectangle"].includes(activeTool);

  const pos = (e) => { const r = e.currentTarget.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  const down = (e) => {
    onActivate();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const [px, py] = pos(e);
    dragRef.current = { px, py };
    if (isMeasure) { const p = toImage(px, py); draftRef.current = { type: activeTool, a: { ...p }, b: { ...p } }; draw(); }
  };
  const move = (e) => {
    if (!dragRef.current) return;
    const [px, py] = pos(e);
    const dx = px - dragRef.current.px, dy = py - dragRef.current.py;
    if (isMeasure && draftRef.current) { draftRef.current.b = toImage(px, py); draw(); }
    else if (activeTool === "wl") onAdjust({ brightness: clamp(regRef.current.brightness - dy * 0.6, 5, 400), contrast: clamp(regRef.current.contrast + dx * 0.6, 5, 400) });
    else if (activeTool === "pan") onAdjust({ panX: regRef.current.panX + dx, panY: regRef.current.panY + dy });
    else if (activeTool === "zoom") onZoom(clamp(regRef.current.zoom * (1 - dy * 0.01), 0.2, 8));
    else if (activeTool === "scroll") { if (Math.abs(dy) > 14) { onFrameStep(dy > 0 ? 1 : -1); dragRef.current.py = py; } }
  };
  const up = () => {
    if (isMeasure && draftRef.current) {
      const m = draftRef.current; draftRef.current = null;
      if (Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y) > 3) onCommit(m); else draw();
    }
    dragRef.current = null;
    draw();
  };
  const wheel = (e) => {
    e.preventDefault();
    if (activeTool === "scroll") onFrameStep(e.deltaY > 0 ? 1 : -1);
    else onZoom(clamp(view.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.2, 8));
  };

  return (
    <div className="vp" style={{ outline: active ? "2px solid var(--brand)" : "none" }}>
      <canvas ref={canvasRef} className="overlay" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onWheel={wheel} />
    </div>
  );
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lineAngle(m) {
  let d = (Math.atan2(m.b.y - m.a.y, m.b.x - m.a.x) * 180) / Math.PI;
  if (d < 0) d += 180;
  if (d > 90) d = 180 - d;
  return d;
}
