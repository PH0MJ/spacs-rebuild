"use client";
import { useMemo } from "react";

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s) {
  let x = escapeHtml(s);
  x = x.replace(/`([^`]+)`/g, "<code>$1</code>");
  x = x.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  x = x.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  x = x.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return x;
}

export function mdToHtml(md) {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inCode = false, codeBuf = [], listType = null, para = [];

  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      if (inCode) { out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`); codeBuf = []; inCode = false; }
      else { flushPara(); closeList(); inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    // table
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      flushPara(); closeList();
      const header = line.split("|").map((c) => c.trim()).filter((c, idx, a) => !(idx === 0 && c === "") && !(idx === a.length - 1 && c === ""));
      let j = i + 2; const rows = [];
      while (j < lines.length && lines[j].includes("|")) {
        const cells = lines[j].split("|").map((c) => c.trim()).filter((c, idx, a) => !(idx === 0 && c === "") && !(idx === a.length - 1 && c === ""));
        rows.push(cells); j++;
      }
      out.push(`<table><thead><tr>${header.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      i = j - 1;
      continue;
    }

    if (/^\s*$/.test(line)) { flushPara(); closeList(); continue; }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flushPara(); closeList(); const lvl = m[1].length; out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`); continue; }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { flushPara(); closeList(); out.push("<hr/>"); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); closeList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
      flushPara();
      if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }
    if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      flushPara();
      if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }
    para.push(line.trim());
  }
  if (inCode && codeBuf.length) out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
  flushPara(); closeList();
  return out.join("\n");
}

export function Markdown({ text }) {
  const html = useMemo(() => mdToHtml(text), [text]);
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}
