// Reset the durable store to a pristine demo seed (run from repo root).
// Usage: node scripts/reset-store.mjs   (needs SPACS_GH_TOKEN + SPACS_GIST_ID, or gh CLI auth)
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import crypto from "node:crypto";

const token = process.env.SPACS_GH_TOKEN || "";
const gistId = process.env.SPACS_GIST_ID || "";
if (!token || !gistId) { console.error("Set SPACS_GH_TOKEN and SPACS_GIST_ID"); process.exit(1); }

// lib/store.js is pure ESM — import it directly via a temp .mjs copy.
import { fileURLToPath } from "node:url";
const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "spacs-"));
copyFileSync(join(scriptDir, "..", "lib", "store.js"), join(tmp, "store.mjs"));
const { buildStore } = await import("file:///" + join(tmp, "store.mjs").replace(/\\/g, "/"));
const store = buildStore();
const content = JSON.stringify(store);

const res = await fetch(`https://api.github.com/gists/${gistId}`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "spacs-rebuild",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ files: { "spacs-store.json": { content } } }),
});
if (!res.ok) { console.error("reset failed:", res.status, await res.text()); process.exit(1); }
const out = await res.json();
console.log("store reset OK → gist", out.id, "·", store.studies.length, "studies,", store.users.length, "users");
