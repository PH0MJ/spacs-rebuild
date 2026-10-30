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

## Docs

The complete reverse-engineering write-up lives in [`docs/sPACS-full-documentation.md`](docs/sPACS-full-documentation.md).
It is also served in-app at [`/docs`](https://spacs-rebuild.vercel.app/docs).

> Demo only. Patient data is synthetic. Not for clinical use. No PHI is stored.
