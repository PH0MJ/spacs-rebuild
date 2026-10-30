// Deterministic synthetic DICOM-web data. No real PACS is contacted.
// Frames are rendered as SVG "scans" so the demo is fully self-contained.

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SERIES_LIB = {
  CR: ["AP", "LATERAL"],
  DR: ["AP"],
  DX: ["PA", "LAT"],
  CT: ["AXIAL", "CORONAL", "SAGITTAL"],
  MR: ["T1 AXIAL", "T2 AXIAL", "STIR SAG"],
  XA: ["RUN 1", "RUN 2"],
  MG: ["CC", "MLO"],
  US: ["SURVEY"],
  NM: ["PLANAR"],
  PT: ["WHOLEBODY"],
  RF: ["FLUORO"],
  XD: ["DERIVED"],
};

export function seriesForStudy(study) {
  const h = hash(study.studyInstanceUid);
  const modalities = study.modality.split(",").map((m) => m.trim()).filter(Boolean);
  const primary = modalities[0] || "CR";
  const labels = SERIES_LIB[primary] || ["SERIES 1", "SERIES 2"];
  const r = rng(h);
  const count = primary === "CT" || primary === "MR" ? 3 : Math.min(labels.length, 1 + Math.floor(r() * 2));
  const out = [];
  for (let i = 0; i < count; i++) {
    const label = labels[i % labels.length];
    const frames = primary === "CT" ? 48 : primary === "MR" ? 28 : primary === "XA" ? 20 : 2;
    out.push({
      seriesInstanceUID: `${study.studyInstanceUid}.${i + 1}`,
      seriesNumber: i + 1,
      seriesDescription: label,
      modality: primary,
      instanceCount: primary === "CT" || primary === "MR" ? 1 : frames,
      frameCount: frames,
    });
  }
  return out;
}

export function instancesForSeries(study, seriesUID) {
  const series = seriesForStudy(study).find((s) => s.seriesInstanceUID === seriesUID);
  if (!series) return [];
  const out = [];
  const n = series.instanceCount;
  for (let i = 0; i < n; i++) {
    out.push({
      sopInstanceUID: `${seriesUID}.${i + 1}`,
      instanceNumber: i + 1,
      numberOfFrames: series.frameCount,
      rows: study.modality.includes("CT") || study.modality.includes("MR") ? 512 : 1024,
      columns: study.modality.includes("CT") || study.modality.includes("MR") ? 512 : 1024,
      windowCenter: 40,
      windowWidth: 400,
      modality: series.modality,
    });
  }
  return out;
}

// Returns a synthetic grayscale image as SVG text.
export function renderFrameSvg(study, seriesUID, sopUID, frame) {
  const seed = hash(`${study.studyInstanceUid}:${seriesUID}:${frame}`);
  const r = rng(seed);
  const modality = (study.modality.split(",")[0] || "CR").trim();
  const isCT = modality === "CT";
  const isMR = modality === "MR";
  const size = 512;
  const depth = Math.round((frame / (isCT ? 48 : 28)) * 100) / 100;

  // Tissue shading varies by slice depth for a volumetric feel.
  const bg = isCT ? `hsl(220 10% ${12 + depth * 8}%)` : isMR ? `hsl(240 12% ${14 + depth * 10}%)` : "hsl(220 12% 8%)";

  const noiseSeed = 1 + (seed % 7);
  const shapes = isCT
    ? `<ellipse cx="256" cy="250" rx="150" ry="175" fill="hsl(220 8% ${34 + depth * 6}%)" stroke="hsl(0 0% 70%)" stroke-width="1"/>
       <ellipse cx="256" cy="250" rx="118" ry="150" fill="hsl(220 8% ${26 + depth * 5}%)"/>
       <ellipse cx="200" cy="215" rx="34" ry="26" fill="hsl(0 0% ${72 - depth * 8}%)"/>
       <ellipse cx="312" cy="215" rx="34" ry="26" fill="hsl(0 0% ${72 - depth * 8}%)"/>
       <ellipse cx="256" cy="215" rx="20" ry="42" fill="hsl(0 0% ${30 + depth * 8}%)"/>`
    : isMR
    ? `<ellipse cx="256" cy="250" rx="160" ry="185" fill="hsl(240 10% ${30 + depth * 5}%)" stroke="hsl(0 0% 65%)" stroke-width="1"/>
       <ellipse cx="256" cy="235" rx="96" ry="120" fill="hsl(240 10% ${48 + depth * 4}%)"/>
       <rect x="228" y="330" width="56" height="70" rx="16" fill="hsl(240 10% ${58 + depth * 4}%)"/>`
    : `<rect x="0" y="0" width="512" height="512" fill="none"/>
       <ellipse cx="256" cy="180" rx="150" ry="150" fill="hsl(215 10% ${42 + depth * 6}%)"/>
       <rect x="150" y="300" width="212" height="190" rx="30" fill="hsl(215 10% ${30 + depth * 5}%)"/>
       <ellipse cx="256" cy="150" rx="20" ry="40" fill="hsl(0 0% 75%)"/>
       <path d="M140 210 Q256 260 372 210" stroke="hsl(0 0% 80%)" stroke-width="2" fill="none"/>
       <path d="M176 330 Q256 300 336 330" stroke="hsl(0 0% 70%)" stroke-width="2" fill="none"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="vig" cx="50%" cy="50%" r="72%">
      <stop offset="60%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.85"/>
    </radialGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${noiseSeed}"/>
      <feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.10"/></feComponentTransfer></filter>
  </defs>
  <rect width="100%" height="100%" fill="${bg}"/>
  ${shapes}
  <rect width="100%" height="100%" filter="url(#grain)"/>
  <rect width="100%" height="100%" fill="url(#vig)"/>
  <g font-family="ui-monospace, monospace" font-size="14" fill="hsl(120 60% 70%)">
    <text x="14" y="24">${escapeXml(study.patientName)}</text>
    <text x="14" y="42">${escapeXml(study.patientId)}</text>
    <text x="14" y="60">${escapeXml(modality)} ${isCT || isMR ? `SLICE ${frame}` : `FRAME ${frame}`}</text>
    <text x="14" y="${size - 14}">WW 400 / WL 40</text>
    <text x="${size - 130}" y="${size - 14}">${escapeXml(study.studyDate)}</text>
  </g>
</svg>`;
}

function escapeXml(s = "") {
  return String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}
