# sPACS — Open-Source Rebuild

A from-scratch, full-stack reconstruction of **sPACS**, a hospital Picture Archiving and
Communication System (PACS) / radiology portal. This is a clean-room rebuild based on the
reverse-engineering documentation in [`docs/sPACS-full-documentation.md`](docs/sPACS-full-documentation.md).

- **Stack:** Next.js 15 (App Router) — React UI + API route handlers, no external database required
- **Data:** deterministic in-memory seed store (demo data), so the whole documented API works out of the box
- **Login page removed:** the app auto-issues a demo session and signs you in as the seeded radiologist
- **DICOM:** a self-contained WADO-RS mock (`/api/dicom-web/*`) serving synthetic study images, with a canvas-based viewer (window/level, zoom, pan, rotate, flip, measurements, presets, cine, layouts, MPR-style view)

## Features

- Welcome dashboard (live clock, greeting)
- Studies list with filters (patient ID/name, modality, date range), report status, auto-refresh
- Web viewer with tools and synthetic imagery
- Radiology report editor (header/body/footer document format, draft → finalize → amend, revisions, clinical templates, print)
- Users, Roles & permission matrix, Preferences
- Print templates (with `{{ variables }}` and portal QR), PACS + Portal settings
- Public study-share portal (`/portal/:shareId`)
- Full documented REST API under `/api/*`

## Development

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy (Vercel)

```bash
npm i -g vercel
vercel --prod
```

## Verify the API

Every endpoint is tested against the live deployment:

```bash
npm run verify:api
# or against your own instance:
BASE=http://localhost:3000 npm run verify:api
```

All API routes require a Bearer token **except** the public ones (`/api/portal-settings`,
`/api/auth/login`, `/api/auth/demo-session`, `/api/study-shares/:id/generate-token`).
Opening a protected route directly in a browser (with no token) correctly returns
`401 {"message":"Unauthenticated."}` — that is auth working, not a missing API.

Get a token and try it:

```bash
TOKEN=$(curl -s -X POST https://spacs-rebuild.vercel.app/api/auth/demo-session | jq -r .token)
curl -s https://spacs-rebuild.vercel.app/api/studies -H "Authorization: Bearer $TOKEN"
```

## Docs

The complete reverse-engineering write-up lives in [`docs/sPACS-full-documentation.md`](docs/sPACS-full-documentation.md).
It is also served in-app at [`/docs`](https://spacs-rebuild.vercel.app/docs).

## Data & durability

The demo uses a **durable JSON store**: state is kept in a private GitHub gist and
revalidated (ETag / 304) before every authenticated request, so writes survive
Vercel's ephemeral serverless instances. Mutating endpoints persist **before**
their response is delivered, which keeps write-then-read sequences consistent
across instances.

- Reading/writing the store requires two encrypted env vars in the Vercel project:
  `SPACS_GH_TOKEN` (a GitHub token) and `SPACS_GIST_ID`. Without them the app
  runs in in-memory mode (fine for local development).
- Reset the demo data to a pristine seed at any time:

```bash
SPACS_GH_TOKEN=… SPACS_GIST_ID=… node scripts/reset-store.mjs
```

> Demo only. Patient data is synthetic. Not for clinical use. No PHI is stored.
