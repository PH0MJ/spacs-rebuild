// Durable persistence layer: GitHub gist-backed JSON store.
// - hydrate(): pull the latest state (ETag-revalidated, 304 => cached copy)
// - persist(): write the current state (skipped when unchanged)
// Without SPACS_GH_TOKEN + SPACS_GIST_ID the app falls back to in-memory only.
import { getStore } from "./store";

const FILE = "spacs-store.json";
const GH_TOKEN = process.env.SPACS_GH_TOKEN;
const GIST_ID = process.env.SPACS_GIST_ID;
export const durable = Boolean(GH_TOKEN && GIST_ID);

let etag = null;
let seeded = false;
let dirty = false; // local mutations not yet durable → local copy is freshest
let lastPersistedSnapshot = null;
let persistQueue = Promise.resolve();

function gistFetch(options = {}) {
  return fetch(`https://api.github.com/gists/${GIST_ID}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "spacs-rebuild",
      ...(options.headers || {}),
    },
  });
}

// Pull remote state into the global store. Safe to call on every request:
// an unchanged remote short-circuits with 304 and keeps the cached copy.
// While local writes are still being persisted, the local copy is the
// freshest — remote refresh is skipped so it can never clobber them.
export async function hydrate() {
  const store = getStore();
  if (!durable) return store;
  if (dirty) return store;
  try {
    const headers = {};
    if (seeded && etag) headers["If-None-Match"] = etag;
    const res = await gistFetch({ headers });
    if (res.status === 304) { seeded = true; return store; }
    if (!res.ok) return store; // network/API hiccup → serve cache
    etag = res.headers.get("etag") || etag;
    const data = await res.json();
    const content = data?.files?.[FILE]?.content;
    if (typeof content === "string" && content.trim().length > 2) {
      try {
        const parsed = JSON.parse(content);
        if (parsed && Array.isArray(parsed.studies)) {
          globalThis.__SPACS_STORE__ = parsed;
          seeded = true;
          lastPersistedSnapshot = content;
          return globalThis.__SPACS_STORE__;
        }
      } catch { /* corrupted content → reseed below */ }
    }
    if (!seeded) { seeded = true; await persist(); }
  } catch { /* offline → serve cache */ }
  return getStore();
}

// Write current state. Writes are serialized; identical snapshots are skipped.
// Resolves once the state is durable (safe to await before responding).
export async function persist() {
  if (!durable) { dirty = false; return; }
  const snap = JSON.stringify(getStore());
  if (snap === lastPersistedSnapshot) { dirty = false; return; }
  const run = async () => {
    try {
      const res = await gistFetch({
        method: "PATCH",
        body: JSON.stringify({ files: { [FILE]: { content: snap } } }),
      });
      if (res.ok) {
        lastPersistedSnapshot = snap;
        etag = res.headers.get("etag") || etag;
        dirty = false;
      }
    } catch { /* stays dirty; next persist retries */ }
  };
  persistQueue = persistQueue.then(run, run);
  return persistQueue;
}
