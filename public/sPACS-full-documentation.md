# sPACS — Complete Reverse-Engineering & Open-Source Documentation

> **Subject:** `https://izahospital.xidanko.qzz.io` — "sPACS", a hospital Picture Archiving and Communication System (PACS) web application
> **Analysis date:** 2026-10-30
> **Method:** REA (Reverse-Engineer-Anything) MCP tooling — passive browser scenario capture, script export, full static JavaScript application analysis (45 files / 1.36 M AST nodes), plus direct static reading of every exported bundle.
> **Access used:** test credentials provided by the site owner (`doctor` account). Real patient data observed in API responses is **deliberately replaced with placeholders** in this document. Tokens/credentials are redacted.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Identity & provenance](#2-identity--provenance)
3. [Deployment & hosting fingerprint](#3-deployment--hosting-fingerprint)
4. [Technology stack](#4-technology-stack)
5. [Complete build-artifact inventory](#5-complete-build-artifact-inventory)
6. [Boot sequence](#6-boot-sequence)
7. [Runtime configuration contract (`window.App`)](#7-runtime-configuration-contract-windowapp)
8. [Internationalization (i18n) system](#8-internationalization-i18n-system)
9. [Theming & design system](#9-theming--design-system)
10. [Authentication system](#10-authentication-system)
11. [Authorization / RBAC model](#11-authorization--rbac-model)
12. [Complete route map (Vue Router)](#12-complete-route-map-vue-router)
13. [Navigation structure](#13-navigation-structure)
14. [Complete API reference](#14-complete-api-reference)
15. [Data models](#15-data-models)
16. [Feature deep-dives](#16-feature-deep-dives)
17. [DICOM integration](#17-dicom-integration)
18. [Web viewer internals (Cornerstone3D)](#18-web-viewer-internals-cornerstone3d)
19. [Progressive Web App (PWA)](#19-progressive-web-app-pwa)
20. [External services & integrations](#20-external-services--integrations)
21. [Security observations](#21-security-observations)
22. [Key reconstructed source (clean pseudocode)](#22-key-reconstructed-source-clean-pseudocode)
23. [Open-source rebuild blueprint](#23-open-source-rebuild-blueprint)
24. [Analysis limitations & unknowns](#24-analysis-limitations--unknowns)
25. [Appendix A — Evidence ledger](#25-appendix-a--evidence-ledger)
26. [Appendix B — Extracted artifact hashes](#26-appendix-b--extracted-artifact-hashes)

---

## 1. Executive summary

**sPACS** is a single-page hospital radiology PACS portal with:

- a **Laravel API backend** (stateless Bearer-token auth via Laravel Sanctum-style `id|random` tokens, `/api/*` JSON endpoints),
- a **Vue 3 SPA frontend** (Vue 3.5.43, Vue Router with permission guards, Tailwind CSS v4.3.3 design system, Reka-UI-style primitives, Lucide icons),
- a **DICOMweb (WADO-RS) proxy** at `/api/dicom-web/…` in front of a configured DICOM node (host/port/AE-title credentials editable in-app),
- a **Cornerstone3D web viewer** (vtk.js + WASM codecs: JPEG baseline/lossless, JPEG-LS, JPEG 2000, HTJ2K/OpenJPH, JPEG XL) with layouts, MPR, cine, measurements and window presets,
- a **structured reporting editor** (Tiptap-based paginated A4 WYSIWYG) with draft → finalize → amendment workflow, revision history, and clinical (report) templates,
- **print templates** (letterhead/footer HTML with `{{ variable }}` placeholders + optional portal QR code on printouts),
- **shareable study links**: a public `/portal/:studyShareId` page that exchanges the share id for a scoped "guest" session token and opens the web viewer after a countdown,
- **external viewer handoff**: `weasis://` and `radiant://` custom-protocol launchers that embed the bearer token,
- **admin tooling**: users, roles & permission matrix, PACS settings, portal branding settings, per-user preferences, per-user access-token generation/revocation, and admin impersonation,
- a **PWA** shell (manifest + Workbox service worker at `/build/sw.js` precaching the whole SPA) with light/dark themes and Arabic/English localization (RTL supported).

Frontend roles/permissions govern every route, button and table column; the backend independently enforces them (401/403 responses observed).

---

## 2. Identity & provenance

| Property | Value |
|---|---|
| Product name | `sPACS` (`window.App.name`) |
| PWA description | "Picture archiving and communication system" |
| HTML `<meta name='creator'>` | `Jalal Al-Mussawi, xidanko07@gmail.com` |
| Footer credit | `© <year> Techport. All rights reserved.` linking to `https://techport-iq.com` |
| Portal default title | `بوابة الفحوصات الطبية` ("Medical Examinations Portal") |
| Portal default description | `مرحباً بك في بوابة عرض الفحوصات الطبية الآمنة.` ("Welcome to the secure medical-examinations viewing portal.") |
| Deployment host | `izahospital.xidanko.qzz.io` (hospital tenant of a multi-tenant deployment; domain suggests the developer's own subdomain service) |
| Language direction | `dir="ltr"` in shell; portal page renders `dir="rtl"`; full RTL support (`rtl:rotate-180` utility classes throughout) |

**Observed user record (test account `doctor`):**

```json
{
  "id": "01a17400-b9ed-72a0-9ed4-9826db9eda4a",
  "name": "Doctor",
  "speciality": "Radiologist",
  "username": "doctor",
  "isActive": true,
  "roles": ["doctor"],
  "permissions": ["Preference.view", "… (28 total, see §11)"],
  "preference": {
    "modalities": ["DX","CT","MG","MR","XA","CR","DR","NM","XD","PT","US","RF"],
    "autoRefreshPeriod": 60,
    "navigationLayout": "compact",
    "defaultHomePage": "/studies"
  }
}
```

IDs are **ULIDs** (26-char, e.g. `01a18ce6-f11a-72a0-a7a1-…`) — consistent with Laravel `HasUuids`/ULID primary keys.

---

## 3. Deployment & hosting fingerprint

- **CDN/proxy:** Cloudflare (managed `robots.txt` with content-signals, `cdn-cgi/rum` Real-User-Monitoring beacons, `static.cloudflareinsights.com` beacon script with token `9f1dfe095e684f8a88fed38de630ec6e`, `data-cf-beacon {"version":"2024.11.0","spa":2}`).
- **Server behavior:**
  - Unknown paths (including unknown `/api/*` paths) return the SPA shell with **HTTP 200 and `text/html`** — there is no JSON 404 handler for bogus API paths (frontend handles the error).
  - `/build/sw.js` serves a real Workbox service worker (`text/javascript`, 3,824 bytes).
  - `/build/manifest.webmanifest` serves the PWA manifest.
- **Dev tooling exposed in production:** a **Laravel Boost browser-logger** script (`/_boost/browser-logs`) intercepts `console.log/debug/info/warn/error/table`, `window.onerror`, `unhandledrejection`, batches them (100 ms debounce) and POSTs JSON `{logs:[{type,timestamp,data,url,userAgent}]}`; also `sendBeacon` on `beforeunload`. Its console banner: `🔍 Browser logger active (MCP server detected)`.
- **Assets:** Vite/rolldown production build under `/build/assets/*` (content-hashed filenames), lazy `<link rel=prefetch>` of all route chunks after `load` (batched 3-at-a-time, `fetchpriority:low`), Laravel `data-vite-manifest`-style modulepreload graph with `import.meta.resolve` polyfill.
- **SPA fallback:** `#app` mount + catch-all index for every non-asset path.

---

## 4. Technology stack

### Frontend (observed, definitive)

| Layer | Technology | Evidence |
|---|---|---|
| Framework | **Vue 3.5.43** (Composition API, `<script setup>` compiled) | version constant in `composables` chunk |
| Router | **Vue Router** (history mode, `beforeEach`/`afterEach` guards, `meta`-driven) | route table in `app-*.js` |
| State | Composables/`ref`/`computed` (no Pinia store strings found) | bundle inspection |
| HTTP | **Axios** instance `baseURL: "/api"`, Bearer header, `X-Locale` header, 401/422 interceptors | `composables-*.js` |
| Styling | **Tailwind CSS v4.3.3** with custom `@theme` tokens (`--brand`, `--surface*`, `--text-*`, `oklch` palette) | CSS header + token block |
| UI primitives | **Reka UI**-style headless components (CSS shows `[data-reka-dropdown-menu-content]`, `[data-reka-popper-content-wrapper]`, `[data-reka-portal]` print rules; Radix-compat selectors too) | CSS print rules |
| Icons | **Lucide** (`lucide-vue-next`-style tree-shaken icon nodes) | icon node data everywhere |
| DICOM viewer | **Cornerstone3D** (`@cornerstonejs/core` + `tools` + `dicom-image-loader`) with **vtk.js** and Emscripten/WASM codecs | tool classes, `wadors:` scheme, worker, WASM files |
| Report editor | **Tiptap** (ProseMirror) with tables; paginated A4 sheet model (794 px = A4 @96dpi) | `report-tiptap-container`, `Te.fromSchema(...).serializeFragment` |
| QR codes | `qrcode` npm library (`toDataURL`, version table 0–40) | `browser-BbITXmSb.js` chunk |
| Toasts | Custom composable + toast host (CSS defensively hides `data-sonner-toaster` in print) | `ab()` factory |
| Utilities | `@vueuse`-style composables (`useDark`, `useToggle`, `onClickOutside`, breakpoint engine `smaller()`), workbox-window | bundle symbols |
| Fonts | **Noto Kufi Arabic** (variable 100–900, Arabic + Latin subsets, `woff2`) | `@font-face` unicode ranges |
| PWA | **vite-plugin-pwa**-generated Workbox SW (`precacheAndRoute`, `cleanupOutdatedCaches`, `skipWaiting`, `clientsClaim`) | `sw.js` |

### Backend (inferred from API responses/behaviour — high confidence)

| Aspect | Inference | Evidence |
|---|---|---|
| Framework | **Laravel** (PHP) | `X-Locale` header, `:param`-style translation keys, Laravel-style 422 validation bodies `{message, errors:{field:[…], …}}`, ULID keys, Sanctum-style token, Boost dev tooling |
| Auth | **Laravel Sanctum** (Bearer `id\|random`) | login response shape; `POST auth/logout`; `revoke-tokens` |
| API style | Stateless JSON REST under `/api` | all observed calls |
| Sessions | "Remember me" implemented **client-side** (`auth-session=1` cookie gate), server issues long-lived tokens | composable logic |
| DICOM node | Configured via PACS settings (host/port/AET + webUrl/user/pass) → proxied at `/api/dicom-web/*` | settings form + proxy endpoints |
| Translations | Laravel localization files served into `window.App.translations` per locale | `/language/{locale}` route, `X-Locale` header |
| Image/asset storage | Laravel `storage/app/public` → `/storage/…` (logos, favicons) | `/storage/assets/favicon/*`, `logoUrl` → `/storage/…` |
| Multi-tenancy | Subdomain-per-hospital deployment pattern (`izahospital.` tenant) | hostname + `window.App.name` |
| Queue/jobs | unknown (not observable from client) | — |

---

## 5. Complete build-artifact inventory

All files under `/build/assets/` (sizes = downloaded bytes; first 12 also have REA SHA-256s in Appendix B):

| File | Bytes | Role |
|---|---|---|
| `app-DnvMERK5.js` | 787,792 | Entry: Vite runtime, router table, guards, app shell, UI components, toast, theme |
| `composables-DYpJyAbE.js` | 268,436 | Vue runtime + all composables: axios, auth, permissions, nav, toast, confirm, i18n `__`, preferences, report/print-template logic |
| `_studyInstanceUid_.viewer-BjbH-ax_.js` | 3,832,193 | Web viewer: Cornerstone3D + vtk.js + DICOM parsing + WASM glue + viewer Vue components |
| `decodeImageFrameWorker-Dkcu389Q.js` | 208,152 | Cornerstone image-decode Web Worker |
| `pages-DDSLX0PQ.js` | 349 | `/` redirect wrapper for WelcomeDashboard |
| `WelcomeDashboard-qThQ9o35.js` | 5,033 | Welcome dashboard (live clock, greeting) |
| `WelcomeDashboard-Dpl1gE8A.css` | 476 | its styles |
| `dashboard-7pBfBQrO.js` | 199 | `/dashboard` → re-exports WelcomeDashboard |
| `login-DB3m4l4l.js` | 3,955 | Login page |
| `studies-k7bltH0P.js` | 19,847 | Studies list + StudyFilters + ShareStudyDialog + viewer-launcher enum |
| `_studyInstanceUid_.report-CNNFDGoU.js` | 55,899 | Radiology report page: Tiptap paginated editor, command bar, history, clinical templates, print |
| `reports-CWDg5W9F.css` | 4,142 | report page styles |
| `_studyInstanceUid_-ZwXivrGe.css` / `-BNUWJboc.css` | 2,644 / 3,609 | report/viewer page styles |
| `_studyShareId_-DwfF5mGF.js` | 5,653 | Public portal page (share exchange) |
| `preferences-D9c3OKf-.js` | 6,714 | Preferences page |
| `print-templates-CZ8SZsrO.js` | 6,226 | Print templates list page |
| `_id_.edit-D2XJmAoM.js` | 1,184 | Print template edit wrapper |
| `PrintTemplateForm-BELVP7if.js` | 20,146 | Print template form + live preview (header/footer/QR) |
| `PrintTemplateForm-DQL72J7V.css` | 2,930 | preview styles |
| `create-CogE4e2e.js` | 1,192 | create print template wrapper |
| `roles-C4Elsfdr.js` | 3,128 | Roles list page |
| `_id_.edit-B8WJH0U8.js` | 1,152 | role edit wrapper |
| `RoleForm-BmEvrlND.js` | 3,225 | Role form + permission matrix |
| `create-Dg6XC9S0.js` | 1,144 | create role wrapper |
| `pacs-BPEYXHdF.js` | 4,223 | PACS settings page |
| `portal-DnGWWMNw.js` | 5,238 | Portal (branding) settings page |
| `users-w74Ol0_P.js` | 6,039 | Users list page |
| `_id_.edit-mCWq-gId.js` | 1,161 | user edit wrapper |
| `UserForm-BAW0-Rvr.js` | 4,335 | User form |
| `create-BTHeljSx.js` | 1,145 | create user wrapper |
| `unauthorized-Cov-5DUd.js` | 1,192 | Access-denied page |
| `PageLayout-BwAMgAOp.js` | 2,327 | PageLayout (title/actions/filters/footer slots + `applyQuery`) |
| `FormLayout-Bbgf7RQl.js` | 1,291 | Form page layout (title, back-to, max-width, skeleton) |
| `useFormErrors-B3lHKkAp.js` | 972 | `getError(field)` helper for 422 errors |
| `DataPagination-D4iBfm5f.js` | 1,010 | Laravel-meta pagination bar |
| `browser-BbITXmSb.js` | 23,906 | `qrcode` library chunk |
| `jpeg-DX29txDl.js`, `jpeg-F6i04JP9.js` | ~ | JPEG codec glue (cornerstone codecs) |
| `lossless-NoYY42n_.js`, `lossless-BZe8yNKi.js` | ~ | JPEG lossless codec glue |
| `charlswasm_decode-CEN7ucFR.wasm` | ~ | JPEG-LS (CharLS) WASM |
| `openjpegwasm_decode-BP3l1OXH.wasm` | ~ | JPEG 2000 (OpenJPEG) WASM |
| `openjphjs-odeu-u12.wasm` | ~ | HTJ2K (OpenJPH) WASM |
| `libjpegturbowasm_decode-B4UEe-KN.wasm` | ~ | JPEG baseline (libjpeg-turbo) WASM |
| `jpegxlwasm_decode-D5WHnpK-.wasm` | ~ | JPEG XL WASM |
| `workbox-window.prod.es5-Bd17z0YL.js` | 5,653 | SW registration client |
| `rolldown-runtime-C0FnF6B9.js` | 1,291 | Rolldown (Vite) module runtime |
| `app-BTjh_tBe.css` | 119,910 | Tailwind v4 design system + tokens + print/scrollbar rules |
| **Total** | **≈ 7.3 MB** | 49 files |

Shell files: `/build/manifest.webmanifest` (923 B), `/build/sw.js` (3,826 B), `/index.html` (Laravel-served SPA shell with per-locale `window.App`).

---

## 6. Boot sequence

```
Browser GET /
 └─ Laravel serves index.html
     ├─ <meta creator> + favicons + PWA manifest + theme-color #05001f
     ├─ window.App = { name:"sPACS", locale:"en", translations:{…} }   ← server-injected per locale
     ├─ theme bootstrap: if localStorage['theme-preference']==='light' → html.classList.remove('dark') else add('dark')
     ├─ <link preload stylesheet> app-BTjh_tBe.css
     ├─ <script type=module> app-DnvMERK5.js (+ modulepreload graph for composables & rolldown-runtime)
     ├─ Boost browser-logger injected (console intercept → /_boost/browser-logs)
     └─ deferred <link rel=prefetch> for every route chunk (3 at a time, after load)

app-DnvMERK5.js (module graph):
 ├─ creates axios instance  (baseURL /api, X-Locale, optional Bearer from storage)
 ├─ restores auth session   (token+user from localStorage; remember-me/cookie gate)
 ├─ registers Vue app: global `__` translator, router, mounts #app
 ├─ router.isReady() → if token && route not public → GET auth/user → load preferences
 ├─ AppLoader overlay until init done (per-route `controlsLoader` opt-out)
 ├─ watch isAuthenticated → force /login?redirect-to=… when lost
 └─ registers service worker /build/sw.js (scope /build/) via workbox-window (immediate)
     └─ patches window.Worker to fix `/build/assets/assets/` → `/build/assets/`
```

---

## 7. Runtime configuration contract (`window.App`)

```js
window.App = {
  name: "sPACS",          // app display name (login title, AppLoader, document.title suffix)
  locale: "en",           // active locale; drives rtl/ltr, date formats, X-Locale header
  translations: { /* server-injected string table for the active locale */ }
};
```

- `__` translator: `rb(key, params)` → `window.App.translations[key] ?? key`, then replaces `:name` placeholders with `params` (Laravel `:param` convention; used e.g. `Are you sure you want to revoke all active sessions for user :name?` with `{name}`).
- `document.title` = `${route.meta.title (translated)} - ${window.App.name}` or just app name.

---

## 8. Internationalization (i18n) system

- Two locales shipped: **English (`en`, default)** and **Arabic (`ar`)**.
- Switch UI in: viewer header (EN/AR pill) and portal. Switch = `localStorage['locale-preference'] = target` then **navigate to `/language/{locale}`** (server route) which sets the locale and redirects back — a full-reload switch.
- Server injects the active locale's string table into `window.App.translations`; `dir` is set server-side per locale (`ltr`/`rtl`).
- Every HTTP API request carries `X-Locale: {window.App.locale}` so the backend returns localized validation/error messages.
- RTL correctness: icons use `rtl:rotate-180`; layout uses logical properties (`start/end`, `ms/me`, `ps/pe`).
- Fonts: Noto Kufi Arabic covers Arabic glyphs with the same family for Latin (variable weight).

---

## 9. Theming & design system

- **Tailwind v4.3.3** with `@theme` mapped tokens (theme → utility color classes):
  - Utility-facing tokens: `bg-bg-base`, `text-text-primary/secondary/muted`, `bg-surface`, `border-surface-border`, `bg-surface-muted/subtle/hover/disabled/stripe`, `text-brand`, `bg-brand/10`, `text-primary/success/danger/warning/info`.
- **Light palette** (`:root`):

  | Token | Value |
  |---|---|
  | `--bg-base` | `#f8fafc` |
  | `--text-primary` | `#0f172a` |
  | `--text-secondary` | `#475569` |
  | `--text-muted` | `#64748b` |
  | `--surface` | `#ffffff` |
  | `--surface-border` | `#e2e8f0` |
  | `--surface-muted` | `#f8fafc` |
  | `--surface-subtle` | `#f1f5f9` |
  | `--surface-hover` | `#f1f5f9` |
  | `--surface-disabled` | `#e2e8f0` |
  | `--surface-stripe` | `#fafbfe` |
  | `--brand` | `#4f46e5` |
  | `--primary` | `#2563eb` |
  | `--success` | `#16a34a` |
  | `--danger` | `#dc2626` |
  | `--warning` | `#d97706` |
  | `--info` | `#0891b2` |

- **Dark palette** (`html.dark`): `--bg-base #090d16`, `--text-primary #f8fafc`, `--text-secondary #94a3b8`, `--surface #101726`, `--surface-border #1e293b`, `--surface-muted #0b111e`, `--surface-subtle #141c2e`, `--surface-hover #192338`, `--surface-disabled #161e30`, `--surface-stripe #0d1424`, `--brand #6366f1`, `--primary #3b82f6`, `--success #10b981`, `--danger #ef4444`, `--warning #f59e0b`, `--info #06b6d4`.
- Full Tailwind palette included in **OKLCH** (zinc/slate/rose/teal/cyan/indigo/amber/emerald…).
- Theme control: `useDark`-style composable (`html` class, storage key `theme-preference`, default **dark**, toggles `dark`/`light`). Login page and shell follow `localStorage['theme-preference']`.
- Signature brand style: `bg-gradient-to-r from-brand to-teal-400 bg-clip-text text-transparent` (gradient text) used on logos, headings, buttons.
- Print media rules hide dialogs/menus/tooltips (`[role=dialog]`, `[role=menu]`, reka/radix popper portals, toaster) and a dedicated `.print:*` utility set exists for report printing.
- Custom scrollbars (6 px, brand-on-hover), scrollbar-width thin.
- Cornerstone canvases are unstyled (`box-shadow:none!important; outline:none!important` on `div[id^=cornerstone-viewport-]`).

---

## 10. Authentication system

### 10.1 Login flow

1. `POST /api/auth/login` with `{ username, password, device_name }`.
   - `device_name` = persisted **device UUID** (`crypto.randomUUID()` fallback random-hex, stored in `localStorage['device-uuid']`).
   - Failure: `422 {message:"These credentials do not match our records.", errors:{username:["…"]}}`.
2. Success `200`:

```json
{
  "token": "<uuid>|<random-43-char>",   // Sanctum-style plain-text token (redacted here)
  "user": { …User with roles, permissions, preference… }
}
```

3. Client stores `auth-token`, `auth-user` (JSON), `auth-remember` (`true`/`false`) and, when **remember-me is OFF**, sets session cookie `auth-session=1` (`path=/`); when ON it deletes that cookie.
4. All requests then send `Authorization: Bearer <token>`.

### 10.2 Session restore gate (remember-me semantics)

On boot:

```js
function restoreSession() {
  const remember = localStorage['auth-remember'] === '1' || localStorage['auth-remember'] === 'true';
  const hasSessionCookie = document.cookie.includes('auth-session=1');
  if (localStorage['auth-token'] && !remember && !hasSessionCookie) {
    // browser session ended → force logout
    remove auth-token / auth-user / auth-remember; return null;
  }
  return localStorage['auth-token'] || sessionStorage['auth-token'];
}
```

- "Remember me" **checked** → token persists across browser restarts (no cookie gate).
- "Remember me" **unchecked** → the `auth-session=1` cookie (a browser-session cookie) acts as a liveness marker; when the browser closes, the cookie disappears and the next visit logs the user out automatically. This is a **client-side** session-expiry trick — the server token itself is not expired.

### 10.3 Other auth operations

| Operation | Call | Notes |
|---|---|---|
| Fetch current user | `GET /api/auth/user` | `{data: User}`; refreshed on every boot for permission freshness |
| Logout | `POST /api/auth/logout` | then wipe storage + `auth-session` cookie + Authorization header |
| Impersonate | `POST /api/users/{id}/impersonate` | returns **new** `{token, user}`; replaces current session (admin feature) |
| Generate user token | `POST /api/users/{id}/generate-access-token` | invalidates that user's existing access tokens |
| Revoke tokens | `POST /api/users/{id}/revoke-tokens` | kills all active sessions of a user |
| Global 401 interceptor | — | clears everything and nulls the reactive session (auto-logout) |
| Global error handler | — | any non-422 HTTP error → `danger` toast with server `message` (or generic) |

### 10.4 Guest / portal sessions

`POST /api/study-shares/{shareId}/generate-token` (public, no auth) returns `{ token, user, studyInstanceUid }` where `user.username === "guest"` and the user's permission set is scoped to viewing that one study. The client `setSession(token, user)` then routes to `/studies/{uid}/viewer`. The router guard explicitly **allows an unauthenticated-acting guest on `/studies/*/viewer`** — this is the public-shared-view path.

---

## 11. Authorization / RBAC model

- Permissions are flat strings `Resource.action` (+ `Own`/`Any` variants) delivered on every `user.permissions` array.
- Frontend helpers (composable `xb`):

```js
hasPermission(p)      => user.permissions.includes(p)
hasAnyPermission([p]) => some
hasAllPermissions([p])=> every
```

- Route guard: `meta.permission` may be a string or array; missing → redirect `/unauthorized`.
- Object ownership: `Own` variants allow the action only when the object's author/userId equals the current user (e.g. `Report.updateOwn`, `PrintTemplate.deleteOwn`); `Any` bypasses ownership. Guard pattern:

```js
canUpdate = canUpdateAny || (canUpdateOwn && report.author.id === me.id)
canFinalize = canFinalize && canUpdate
```

### 11.1 Complete permission catalogue (from enum definitions + API)

| Resource | Permissions |
|---|---|
| `Preference` | `.view`, `.update` |
| `PrintTemplate` | `.viewOwn .viewAny .listOwn .listAny .createOwn .createAny .updateOwn .updateAny .deleteOwn .deleteAny` |
| `ReportTemplate` | `.listOwn .listAny .create .updateOwn .updateAny .deleteOwn .deleteAny` |
| `Report` | `.view .create .updateOwn .updateAny .finalize` (+ `.deleteOwn .deleteAny` granted to doctor role — enumerated in backend `GET /api/permissions`) |
| `Study` | `.view` |
| `StudyShare` | `.create` |
| `PacsSetting` | `.view`, `.update` |
| `PortalSetting` | `.view`, `.update` |
| `Role` | `.view .list .create .update .delete` |
| `User` | `.view .list .create .update .revokeAllTokens .generateAccessToken .impersonate` |

Observed `doctor` role grants (28): `Preference.view, Preference.update, PrintTemplate.* (10), ReportTemplate.* (8), Report.view/create/updateOwn/updateAny/finalize/deleteOwn/deleteAny, Study.view, StudyShare.create, User.list`.

The **permission universe** is served by `GET /api/permissions` (used by the Role form matrix, which groups by resource prefix = text before the first `.` and renders "Select all / Unselect all" per group).

---

## 12. Complete route map (Vue Router)

All routes are defined in `app-DnvMERK5.js`; lazy chunks resolve through Vite's `__vite__mapDeps` prefetcher.

| Path | Name | Component chunk | Meta |
|---|---|---|---|
| `/` | `/` | `pages-DDSLX0PQ.js` | `{title:"Home"}` — redirects to `defaultHomePage` when set; renders WelcomeDashboard when home = `/` |
| `/dashboard` | `/dashboard` | `dashboard-7pBfBQrO.js` | `{title:"Home"}` — same dashboard |
| `/login` | `/login` | `login-DB3m4l4l.js` | `{public:true, title:"Sign In"}` |
| `/portal/:studyShareId` | `/portal/[studyShareId]` | `_studyShareId_-DwfF5mGF.js` | `{public:true, title:"بوابة الفحوصات الطبية", fullScreen:true, controlsLoader:true}` |
| `/preferences` | `/preferences/` | `preferences-D9c3OKf-.js` | `{title:"Preferences", permission: Preference.view}` |
| `/print-templates` | `/print-templates/` | `print-templates-CZ8SZsrO.js` | `{title:"Print Templates", permission:[PrintTemplate.listAny, PrintTemplate.listOwn]}` |
| `/print-templates/:id/edit` | `/print-templates/[id].edit` | `_id_.edit-D2XJmAoM.js` | `{title:"Edit Print Template", permission:[PrintTemplate.updateAny, PrintTemplate.updateOwn]}` |
| `/print-templates/create` | `/print-templates/create` | `create-CogE4e2e.js` | `{title:"Create Print Template", permission:[PrintTemplate.createAny, PrintTemplate.createOwn]}` |
| `/roles` | `/roles/` | `roles-C4Elsfdr.js` | `{title:"Roles & Permissions", permission: Role.view}` |
| `/roles/:id/edit` | `/roles/[id].edit` | `_id_.edit-B8WJH0U8.js` | `{title:"Edit Role", permission: Role.update}` |
| `/roles/create` | `/roles/create` | `create-Dg6XC9S0.js` | `{title:"Create Role", permission: Role.create}` |
| `/settings/pacs` | `/settings/pacs/` | `pacs-BPEYXHdF.js` | `{title:"PACS Settings", permission: PacsSetting.view}` |
| `/settings/portal` | `/settings/portal/` | `portal-DnGWWMNw.js` | `{title:"Portal Settings", permission: PortalSetting.view}` |
| `/studies` | `/studies/` | `studies-k7bltH0P.js` | `{title:"Studies", permission: Study.view}` |
| `/studies/:studyInstanceUid/report` | `/studies/[studyInstanceUid].report` | `_studyInstanceUid_.report-CNNFDGoU.js` | `{title:"Radiology Report", permission: Report.view, fullScreen:true}` |
| `/studies/:studyInstanceUid/viewer` | `/studies/[studyInstanceUid].viewer` | `_studyInstanceUid_.viewer-BjbH-ax_.js` | `{title:"Web Viewer", permission: Study.view, fullScreen:true}` |
| `/unauthorized` | `/unauthorized` | `unauthorized-Cov-5DUd.js` | `{public:true, title:"Access Denied"}` |
| `/users` | `/users/` | `users-w74Ol0_P.js` | `{title:"Users Management", permission: User.view}` |
| `/users/:id/edit` | `/users/[id].edit` | `_id_.edit-mCWq-gId.js` | `{title:"Edit User", permission: User.update}` |
| `/users/create` | `/users/create` | `create-BTHeljSx.js` | `{title:"Create User", permission: User.create}` |

### Global guards (`router.beforeEach`)

```js
let { isAuthenticated, user } = useAuth();
let guest = isAuthenticated && user.username === 'guest';
let onSharedViewer = path.startsWith('/studies/') && path.endsWith('/viewer');

if (guest && !public && !onSharedViewer) return '/login';              // guests only see the shared viewer
if (!public && !isAuthenticated) return { path:'/login', query:{ 'redirect-to': fullPath } };
if (path === '/login' && isAuthenticated && !guest)                    // logged-in user visiting /login
    return typeof query['redirect-to'] === 'string' ? query['redirect-to'] : '/';
let required = meta.permission;                                        // string | array
if (required && !(Array.isArray(required) ? hasAnyPermission(required) : hasPermission(required)) && !(guest && onSharedViewer))
    return '/unauthorized';
```

`router.afterEach`: sets `document.title` from translated `meta.title` + app name.

---

## 13. Navigation structure

Three selectable layouts (user preference `navigationLayout`): **Sidenav** (default), **Compact Rail** (icon-only), **Topbar**. Shell: `flex h-dvh` with sidebar/topbar + `<main class="p-4 md:p-8">`.

Nav items (generated from permissions; icons are Lucide):

| Label | Route | Icon | Visibility |
|---|---|---|---|
| Home | `defaultHomePage==='/d' ? '/' : '/dashboard'` (active on `/` or `/dashboard`) | house | always |
| Studies | `/studies?studyDate=today,today` | database | `Study.view` |
| Users | `/users` | users | `User.view` |
| Roles | `/roles` | shield | `Role.view` |
| Print Templates | `/print-templates` | printer | `[PrintTemplate.listAny, listOwn]` |
| Preferences | `/preferences` | sliders-vertical | `Preference.view` |
| PACS Settings | `/settings/pacs` | settings | `PacsSetting.view` |
| Portal Settings | `/settings/portal` | globe | `PortalSetting.view` |

Shell extras: brand gradient app name (RouterLink `/`), layout-aware nav list, theme toggle + locale switch + user avatar dropdown (initials circle, menu items).

---

## 14. Complete API reference

Base: `https://izahospital.xidanko.qzz.io/api` — JSON only, `Authorization: Bearer <token>` (except where noted), errors: `401 {"message":"Unauthenticated."}` or `422 {message, errors:{field:[…], …}}`.

### 14.1 Auth

| Method | Path | Auth | Body / Params | Response |
|---|---|---|---|---|
| POST | `/auth/login` | public | `{username, password, device_name}` | `{token, user}` (422 on bad creds) |
| POST | `/auth/logout` | Bearer | — | — |
| GET | `/auth/user` | Bearer | — | `{data: User}` |
| GET | `/permissions` | Bearer | — | flat `string[]` of all permission names (for Role form) |
| POST | `/users/{id}/impersonate` | Bearer (User.impersonate) | — | `{token, user}` |
| POST | `/users/{id}/generate-access-token` | Bearer (User.generateAccessToken) | — | success; invalidates that user's previous access token |
| POST | `/users/{id}/revoke-tokens` | Bearer (User.revokeAllTokens) | — | success |

### 14.2 Users & roles

| Method | Path | Auth | Params | Response |
|---|---|---|---|---|
| GET | `/users` | Bearer (User.view) | `?search=&status=active|inactive|''&page=` | `{data: User[], meta: LaravelPagination}` |
| GET | `/users/list` | Bearer | — | `{data:[…]}` id/name list (used for filters) |
| GET | `/users/{id}` | Bearer (User.view) | — | `{data: User}` |
| POST | `/users` | Bearer (User.create) | `{name, speciality, username, password, password_confirmation, isActive, roles[]}` | `{data: User}` |
| PUT | `/users/{id}` | Bearer (User.update) | same (password optional) | `{data: User}` |
| GET | `/roles` | Bearer (Role.view) | `?search=&page=` | `{data: Role[], meta}` (roles include `permissions[]`, `usersCount` badge info) |
| GET | `/roles/list` | Bearer | — | role names list |
| GET | `/roles/{id}` | Bearer | — | `{data: Role}` |
| POST | `/roles` | Bearer (Role.create) | `{name, permissions[]}` | `{data: Role}` |
| PUT | `/roles/{id}` | Bearer (Role.update) | `{name, permissions[]}` | `{data: Role}` |
| DELETE | `/roles/{id}` | Bearer (Role.delete) | — | — |

### 14.3 Preferences

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/preferences` | Bearer | — | `{data:{modalities:string[], autoRefreshPeriod:number, navigationLayout:"sidenav"|"compact"|"topbar", defaultHomePage:string}}` |
| PUT | `/preferences` | Bearer (Preference.update) | same object (numeric coercion of period) | `{data: …}` |

### 14.4 Studies, reports, shares

| Method | Path | Auth | Params/Body | Response |
|---|---|---|---|---|
| GET | `/studies` | Bearer (Study.view) | `?patientId=&patientName=&modality=CT|''&studyDate=YYYY-MM-DD,YYYY-MM-DD&page=` | `{data: Study[], meta}` |
| GET | `/studies/{studyInstanceUid}` | Bearer | — | `{data: Study}` (full record) |
| GET | `/studies/{uid}/report` | Bearer (Report.view) | — | `{data: Report|null, share: StudyShare|null}` |
| POST | `/studies/{uid}/reports/draft` | Bearer (Report.create/update*) | `{content}` (report document string, §16.3) | `{data: Report, share}` |
| POST | `/studies/{uid}/reports/finalize` | Bearer (Report.finalize) | `{content}` | `{data: Report, share}` — signs the report |
| POST | `/studies/{uid}/reports/amend` | Bearer (Report.update* on finalized) | `{content, revisionReason}` | `{data: Report, share}` |
| GET | `/reports/{reportId}/revisions` | Bearer | — | revision history list |
| POST | `/study-shares` | Bearer (StudyShare.create) | `{studyInstanceUid, expiresAt: ISO|null}` | `{data:{id, studyInstanceUid, expiresAt, shareLink}}` |
| POST | `/study-shares/{shareId}/generate-token` | **public** | — | `{token, user(guest), studyInstanceUid}` (fails with "This share link has expired." when past `expiresAt`) |

### 14.5 Templates

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/print-templates` | Bearer (PrintTemplate.list*) | `?search=&user=|all|system|<id>` | `{data: PrintTemplate[]}` |
| GET | `/print-templates/{id}` | Bearer | — | `{data: PrintTemplate}` |
| POST | `/print-templates` | Bearer (PrintTemplate.create*) | `{name, header, footer, includePortalQr, isDefault, userId?}` | `{data: PrintTemplate}` |
| POST* | `/print-templates/{id}` | Bearer (PrintTemplate.update*) | same | `{data: …}` (create-style POST used for update in UI) |
| DELETE | `/print-templates/{id}` | Bearer (PrintTemplate.delete*) | — | — |
| GET | `/report-templates` | Bearer (ReportTemplate.list*) | — | `{data: ReportTemplate[]}` |
| POST | `/report-templates` | Bearer (ReportTemplate.create) | `{name, content}` | `{data: ReportTemplate}` |
| PUT | `/report-templates/{id}` | Bearer (ReportTemplate.update*) | `{name, content}` | `{data: …}` |
| DELETE | `/report-templates/{id}` | Bearer (ReportTemplate.delete*) | — | — |
| POST | `/editor/upload-image` | Bearer | multipart image | uploaded image URL (Tiptap editor image upload) |

### 14.6 Settings

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/settings/pacs` | Bearer (PacsSetting.view) | — | `{data:{dicomHost, dicomPort(11112), dicomAet, webUrl, username, password}}` |
| PUT | `/settings/pacs` | Bearer (PacsSetting.update) | `{dicomHost, dicomPort:Number, dicomAet, webUrl, username, password}` | success (422 validation) |
| GET | `/settings/portal` | Bearer (PortalSetting.view) | — | `{data:{logoUrl, title, description, redirectDelay, footerText, showStudyDetailsInQr}}` |
| POST | `/settings/portal` | Bearer (PortalSetting.update) | `multipart/form-data`: `logo` (file, or empty string to remove), `title`, `description`, `redirectDelay`, `footerText`, `showStudyDetailsInQr` (1/0) | `{data: …updated}` |
| GET | `/portal-settings` | **public** | — | `{data:{logoUrl, title, description, redirectDelay, footerText, showStudyDetailsInQr}}` (live values for the public portal page) |

### 14.7 DICOMweb (WADO-RS) proxy

Base: `/api/dicom-web` (authenticated by the same Bearer token; guest tokens scope to one study).

| Method | Path | Accept | Purpose |
|---|---|---|---|
| GET | `/dicom-web/studies/{studyUID}/series` | `application/json` | series list (QIDO) |
| GET | `/dicom-web/studies/{studyUID}/series/{seriesUID}/metadata` | `application/dicom+json` | instance metadata for a series |
| GET | `/dicom-web/studies/{studyUID}/series/{seriesUID}/instances/{sopUID}/metadata` | `application/dicom+json` | single baseline-instance metadata |
| GET | `/dicom-web/studies/{studyUID}/series/{seriesUID}/instances/{sopUID}/frames/1/rendered` | blob | thumbnail (first frame rendered) |
| GET | `/dicom-web/studies/{studyUID}/series/{seriesUID}/instances/{sopUID}/frames/{n}` | `wadors:` (cornerstone) | pixel frames for the loader |

### 14.8 Misc endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/_boost/browser-logs` | Laravel Boost console-log sink (public) |
| GET | `/language/{locale}` | server-side locale switch + redirect (full reload) |
| POST | `/cdn-cgi/rum` (Cloudflare) | RUM telemetry |

### 14.9 Standard response & pagination shapes

- Collection: `{ "data": [...], "meta": { current_page, from, last_page, path, per_page, to, total, links } }` (Laravel paginator).
- Validation error `422`: `{ "message": "The given data was invalid.", "errors": { field: ["…"] } }` — `useFormErrors().getError(field)` renders the first message.
- Login failure message observed: `"These credentials do not match our records."`

---

## 15. Data models

Shapes as observed on the wire (types inferred; `—` = not observed).

### User
`id: ULID, name, speciality, username, isActive: bool, roles: string[] (role names), permissions: string[], preference: Preference`
Create/update fields: `name, speciality, username, password, password_confirmation, isActive, roles[]`.

### Role
`id, name, permissions: string[]` (+ user badge info in list).

### Study
```json
{
  "studyInstanceUid": "1.3.46.670589…",
  "patientId": "<MRN>",
  "patientName": "<PATIENT NAME>",
  "age": "48 Y | —",
  "gender": "Male | Female",
  "modality": "CR | CT | MR | XA | …",
  "studyDescription": "Coronary^Diagnostic …",
  "studyDate": "YYYY-MM-DD",
  "studyTime": "hh:mm AM/PM",
  "report": Report | null
}
```
*(Patient fields above are placeholders — real PHI present in live responses.)*

### Report
```json
{
  "id": "ULID",
  "studyInstanceUid": "…",
  "status": "draft | final | amended",
  "content": "<!-- REPORT_HEADER_START --><div class=\"report-header\">…</div><!-- REPORT_HEADER_END --><!-- REPORT_BODY_START --><div class=\"report-body\">…</div><!-- REPORT_BODY_END --><!-- REPORT_FOOTER_START --><div class=\"report-footer\">…</div><!-- REPORT_FOOTER_END -->",
  "finalizedAt": "ISO-8601 with offset (+03:00)",
  "revisionsCount": 0,          // on report page
  "author": { "id": "ULID" },
  "studyShare": StudyShare|null
}
```

### ReportRevision (via `/reports/{id}/revisions`)
Revision records for finalized/amended reports (reason: `revisionReason` on amend).

### StudyShare
```json
{ "id":"ULID", "studyInstanceUid":"…", "expiresAt": null|"ISO", "shareLink":"https://…/portal/<id>", "createdAt":"ISO", "updatedAt":"ISO" }
```
Expiry options in UI: `1day | 7days | 30days | never(→null)`.

### PrintTemplate
`id, name, isDefault: bool, userId|null (null = System/Global), header: html, footer: html, includePortalQr: bool, user?: {name}`

### ReportTemplate (clinical macros)
`id, name, content: html, userId|null` — created from current editor content.

### Preference
`modalities: string[], autoRefreshPeriod: number(seconds, 0 = off), navigationLayout: 'sidenav'|'compact'|'topbar', defaultHomePage: route`

### PacsSetting
`dicomHost, dicomPort (default 11112), dicomAet, webUrl, username, password`

### PortalSetting
`logoUrl (path under /storage), title, description, redirectDelay (seconds; 0 = immediate), footerText, showStudyDetailsInQr: bool`

### Modality enum (fixed list in filters/preferences)
`CR, CT, DR, DX, MG, MR, NM, PT, RF, US, XA, XD`

---

## 16. Feature deep-dives

### 16.1 Welcome dashboard (`/`, `/dashboard`)
- Live clock (HH:MM:SS AM/PM, 1-s interval, blinking colon), localized long date chip.
- Time-of-day greeting (Good morning/afternoon/evening) with sun/moon icon and color glow.
- User initials avatar; animated gradient orbs + dot-grid background (`animate-orb-pulse`, `animate-pulse-ring`, `animation-delay-2000`).
- "Have a wonderful and productive day!" footer.
- `/` route: immediately `router.replace(defaultHomePage)` unless it is `/`.

### 16.2 Studies list (`/studies`)
- **Filters** (`StudyFilters`): Patient ID text, Patient Name text, Modality select (`All Modalities` + active modalities from preference, else full 12), Study Date **range** picker with `today`/`yesterday` presets (default = today..today). Every change syncs URL query (`patientId, patientName, modality, studyDate, page=1`) via `PageLayout.applyQuery`.
- **Data**: `GET /studies` with query; auto-refresh timer from `preferences.autoRefreshPeriod` (only if ≥ 60 s; skipped while a request is in-flight).
- **Columns**: Patient ID, Patient Name, Age, Gender, Modality (brand chip), Study Description, Study Date, Study Time, Report, VIEWERS, share.
- **Report cell** (requires `Report.view`): link to report page with status badge — `Final` (success), `Amended` (primary), `Draft` (warning), or neutral `Write` when none.
- **Viewer launchers** (`VIEWERS` column):
  - `Web` → router push `/studies/{uid}/viewer`.
  - `Weasis` → builds `weasis://?$dicom:rs --url "{origin}/api/dicom-web" -r "studyUID={uid}" -H "Authorization: Bearer {token}"` (URL-encoded) and `window.location.href = …` (custom protocol prompt).
  - `RadiAnt` → `radiant://?n=pstv&v=0020000D&v={uid}` (0020,000D = StudyInstanceUID).
  - Button shows a spinner while the protocol is being launched.
- **Share dialog** (`ShareStudyDialog`): expiry radio (1 Day / 7 Days / 30 Days / Never Expire) → `POST /study-shares {studyInstanceUid, expiresAt}` → shows readonly `shareLink`, QR code image (`qrcode.toDataURL(link,{width:600,margin:1})`), Copy to clipboard (2 s "Copied" state), **Print QR Code** (opens a blank window, writes a full HTML document honoring `document.documentElement.dir`, patient details optionally included per `showStudyDetailsInQr`, footer credit).
- Loading/error states: table skeleton, error banner from server message.

### 16.3 Radiology report editor (`/studies/:uid/report`)
- **Document model** (stored in `report.content`):

```html
<!-- REPORT_HEADER_START --><div class="report-header">…letterhead html…</div><!-- REPORT_HEADER_END -->
<!-- REPORT_BODY_START --><div class="report-body">…pages joined by <!-- PAGE_BREAK -->…</div><!-- REPORT_BODY_END -->
<!-- REPORT_FOOTER_START --><div class="report-footer">…sign-off html…</div><!-- REPORT_FOOTER_END -->
```

  - Body is split on `<!-- PAGE_BREAK -->` into pages; `<!-- MANUAL_PAGE_BREAK -->` prefix marks a manually broken page.
- **Editor**: Tiptap (ProseMirror) per page, A4 sheet (794 px container), tables, images (upload endpoint), **automatic overflow pagination** — binary search of the last fitting node using `coordsAtPos`, moves overflow content (including table rows) to the next page, merges on Backspace/Delete at page edges, `Ctrl/⌘+Enter` inserts a page break, keyboard-aware selection restoration, `IntersectionObserver` + `document.fonts.ready` reflow scheduling (150 ms debounce).
- **Command bar** (`ReportCommandBar`): patient name/modality chip/PID (mono)/date/description; report status badge; save-state indicator (`Saving draft…` / `Unsaved changes` / `All changes saved`); print-template select (default template labelled); buttons: `Save Draft`, `Sign & Finalize` (confirm dialog: "Once finalized, further edits will require an amendment log."), `Edit / Amend` (opens amendment dialog with reason), `Templates` (clinical macro dialog), `Print Report (Ctrl+P)`, `History (n)`. Responsive: smaller breakpoints collapse actions into a dropdown.
- **Print pipeline**: selected print template's header/footer are `{{ variable }}`-rendered with real study/user data, prepended/appended to the body pages, portal QR (share link) optionally injected, then the browser print dialog prints the A4 sheets (print CSS hides app chrome).
- **History**: `GET /reports/{id}/revisions` shown in a dialog (revision list).
- **Clinical templates dialog**: list/preview/create (`Save current findings as template` — POST), update (PUT with current editor content), delete, apply-with-confirm (replaces editor content). Ownership-aware (updateOwn/deleteOwn).
- Leave-with-unsaved-changes confirm (`Leave Without Saving` / `Keep Editing`).

### 16.4 Public portal (`/portal/:studyShareId`)
- Loads `GET /portal-settings` and `POST /study-shares/{id}/generate-token` **in parallel**.
- Branded card: logo (`/storage/{logoUrl}`) or gradient `sPACS` wordmark; title; description; progress bar counting to `redirectDelay` (default 3 s, 0 = instant); footer text + `© year Techport` credit; `dir="rtl"` styling by default.
- On success: `setSession(token, guestUser)` → redirect `/studies/{studyInstanceUid}/viewer`.
- On failure: red shield-x panel with Arabic messages — expired: `عذراً، لقد انتهت الصلاحية الزمنية المحددة لرابط المشاركة هذا.`; invalid/cancelled: `رابط المشاركة الموفر غير صالح، أو تم إلغاؤه من قبل طبيبك المعالج.`

### 16.5 Users management (`/users`)
- Filters: search input (300 ms debounce; `?search=`), status select (`All Statuses/Active Only/Inactive Only`; `?status=`), pagination.
- Columns: Full Name, Username, Roles (up to 3 badges + `+N more` tooltip), Status (Active/Inactive dot chip), Access Token column **only when** `User.generateAccessToken` (monospace token, copy-to-clipboard button).
- Row actions: Edit (`User.update`), Impersonate (`User.impersonate`, hidden on self; confirm; switches session and routes `/`), Generate Token (`User.generateAccessToken`; confirm: "…will invalidate any existing access tokens."), Revoke Tokens (`User.revokeAllTokens`; confirm "…revoke all active sessions for user :name?").
- Create/Edit (`UserForm`): Full Name, Speciality/Title, Username, Password + confirmation (create; optional on edit), Active toggle, Roles multiselect (`GET /roles/list`).

### 16.6 Roles & permissions (`/roles`)
- Filters: search (debounced). Columns: Role Name, Permissions (badges, `+N more`), Actions: Edit (`Role.update`), Delete (`Role.delete`; confirm).
- Role form: Name + **permission matrix**: `GET /api/permissions` → grouped by resource prefix, per-group Select all/Unselect all, checkbox per permission with humanized label (`PrintTemplate.viewAny` → "View Any").

### 16.7 PACS settings (`/settings/pacs`)
- Fields: DICOM Host (e.g. `127.0.0.1`), DICOM Port (default 11112), DICOM AE Title, Web URL (WADO-RS base of the downstream node), Username, Password.
- `GET settings/pacs` on load (password round-trips from the server), `PUT settings/pacs` on save; per-field 422 errors; FormLayout skeleton while loading.

### 16.8 Portal settings (`/settings/portal`)
- Fields: Logo upload (multipart; preview from `/storage/{logoUrl}`; empty string clears), Title, Description, Redirect Delay (seconds), Footer Text, Show Study Details in QR (toggle).
- `GET/POST settings/portal` (POST is `multipart/form-data`).

### 16.9 Print templates (`/print-templates`)
- Filters: search + **user filter** (visible with `PrintTemplate.listAny`): `All Templates | System (Global) | <each user>` (options from `GET /users/list`).
- Columns: Template Name (+ `Default` badge), User (or System (Global) chip), Header (Configured/—), Footer (Configured/—), Portal QR (Included/Excluded), Actions (Edit/Delete with ownership rules). "Configured" = non-empty text after tag strip OR contains `img|table|hr`.
- Editor (`PrintTemplateForm`): Name, Header HTML, Footer HTML (with variable inserter), `includePortalQr` toggle, `isDefault`, user assignment; **live preview** (`PrintTemplatePreview`) — header/footer rendered with sample data, sample clinical body (Clinical Indication / Technique / Findings / Impression), portal QR slot; image upload inside the HTML editors (`POST /editor/upload-image`).
- Variable renderer: `{{ name }}` → value from the variable table (case-insensitive fallback), missing → empty string.

### 16.10 Print-template variables (complete list)

| Key | Label | Sample | Category |
|---|---|---|---|
| `patientName` | Patient Name | John Doe | patient |
| `patientId` | Patient ID | PID-2026-8941 | patient |
| `age` | Age | 45Y | patient |
| `gender` | Gender | Male | patient |
| `studyDate` | Study Date | 2026-09-26 | study |
| `studyTime` | Study Time | 14:30:15 | study |
| `studyDescription` | Study Description | CT Brain Without Contrast | study |
| `modality` | Modality | CT | study |
| `accessionNumber` | Accession Number | ACC-55210 | study |
| `userName` | Doctor Name | Dr. Jane Smith | doctor |
| `userSpeciality` | Speciality / Title | Consultant Radiologist | doctor |
| `reportDate` | Report Date | 2026-09-26 | other |
| `currentDate` | Current Date | today | other |

A default letterhead table generator (RADIOLOGY REPORT strip + patient/ID/modality/age-gender row) is embedded for fallback.

### 16.11 Preferences (`/preferences`)
- **Navigation Layout**: card picker — Sidebar (Default) / Compact Rail / Topbar with descriptions and icons.
- **Default Home Page**: select = `Home (Welcome Dashboard)` + every nav destination (query-stripped).
- **Active Modalities**: 12 checkboxes (grid) — used as study filters.
- **Auto-Refresh**: seconds value for studies auto-refresh (0 = off).
- Save: `PUT /preferences` (numeric coercion); 422 field errors displayed.

### 16.12 Unauthorized (`/unauthorized`)
Shield-alert icon in danger circle, "Access Denied", "You do not have the required permissions to access this page.", Back button → `/`.

---

## 17. DICOM integration

- **In-app path**: `/api/dicom-web/*` is a WADO-RS/QIDO-RS proxy implemented by the backend, configured via PACS settings (host/port/AET/webUrl/user/pass). All calls carry the session Bearer token (user token, or the guest token for a shared study).
- **Series loading algorithm** (viewer):
  1. `GET …/series` → list; for each series fetch `…/series/{s}/metadata`.
  2. Classify: SOPClassUID `1.2.840.10008.5.1.4.1.1.66` (SR) or missing Rows/Columns → series marked `RAW` (not rendered; excluded from MPR), unless modality is in a special keep-list (e.g. segmentation-like modalities).
  3. Fetch first-instance metadata (`…/instances/{sop}/metadata`) as the baseline; count frames via `NumberOfFrames`.
  4. Build per-frame entries: `wadors:{origin}/api/dicom-web/studies/{s}/series/{t}/instances/{sop}/frames/{n}`; register instance metadata in the wadors `metaDataManager`.
  5. Sort series by `SeriesNumber` → then date/time → description → UID; sort instances by `InstanceNumber`.
  6. Extract per-frame `ImagePositionPatient` (per-frame functional groups honored), `ImageOrientationPatient`, `PixelSpacing` (with `ImagerPixelSpacing` + `PixelMeasuresSequence` fallbacks), `WindowCenter/Width`, Rows/Columns.
  7. First-frame thumbnail via `…/frames/1/rendered` (blob URL) for the sidebar.
- **Transfer syntaxes/codec matrix** (decoded in the worker): Implicit/Explicit VR LE/BE, Deflated, JPEG Baseline (1.2.4.50), JPEG Extended (1.2.4.51/57/70), JPEG Lossless (1.2.4.57/70), JPEG-LS (1.2.4.80/81), JPEG 2000 (1.2.4.90/91), HTJ2K (OpenJPH), JPEG XL — matching the WASM set: `charlswasm_decode`, `openjpegwasm_decode`, `openjphjs`, `libjpegturbowasm_decode`, `jpegxlwasm_decode` + JS codec glue.
- **3D/RT support**: vtk.js readers for PLY/OBJ/STL/MTL/VTP (mesh loading path in the cornerstone stack).
- **External handoff**: Weasis (WADO-RS with inline Bearer header) and RadiAnt (query-param study UID) custom protocols.

---

## 18. Web viewer internals (Cornerstone3D)

Components (all inside `_studyInstanceUid_.viewer-BjbH-ax_.js`):

| Component | Responsibility |
|---|---|
| `StudySidebar` | series thumbnails (first-frame rendered blobs), frame counts, RAW/hidden series handling, study info |
| `StudyViewport` | Cornerstone `RenderingEngine` grid, viewport lifecycle, tools setup, MPR volume building, link scrolling |
| `ViewerHeader` | patient strip (name • PID • age • sex • description • date), presets select, tools, manipulators, cine, layouts, link, MPR toggle, mouse settings, language pill, Back to Studies (Study.view) |
| `ToolSelector` | `wl` Window/Level, `zoom`, `pan`, `scroll` (Stack Scroll), `crosshairs` (MPR only); measurement dropdown: `length`, `angle`, `ellipse` (area), `rectangle` (area); `Clear All` |
| `ViewportManipulators` | Invert Colors, Rotate 90°, Flip H, Flip V, Reset View |
| `LayoutSwitcher` | `1x1, 1x2, 2x1, 2x2` (MPR mode ignores it) |
| `PresetSelector` | Default (ww/wl null), Soft Tissue (350/40), Lung (1600/−600), Bone (2000/450), Brain (80/40) |
| `CineControls` | play/pause + FPS for multiframe series |
| `MouseSettingsDialog` | per-button tool mapping |
| `ViewerReportPanel` | side report view (status, content) alongside images |
| `ViewportPlaneSwitcher` | orientation switch in MPR |

- **MPR**: builds a volume from the active series (requires `isMprSupported` + active series), enables Crosshairs + ReferenceLines tools; layouts disabled while active.
- **Link series**: synchronized scrolling across viewports.
- **Cornerstone tool stack observed** (classes): `LengthTool`, `AngleTool`, `ReferenceLinesTool`, `PlanarFreehandContourSegmentationTool`, `StackScroll`… standard Cornerstone3D annotation architecture (handles, text boxes, undo/redo `z`/`y`, memos).
- **Worker**: image decode offloaded to `/build/assets/decodeImageFrameWorker-Dkcu389Q.js`; worker pool sized to `hardwareConcurrency/2` (min 1); `window.Worker` path-patching for the `/build` scope.
- **Rendering**: GPU (WebGL/WebGPU via vtk) with CPU fallback path in the viewport class; sharpening/smoothing render passes; VOI LUT, modality LUT modules referenced (`modalityLutModule`, `voiLUTFunction`, `scalingModule`, `imagePlaneModule`, `imagePixelModule`, `sopCommonModule`).

---

## 19. Progressive Web App (PWA)

- **Manifest** (`/build/manifest.webmanifest`): name/short name `sPACS`, description "Picture archiving and communication system", `start_url /`, `display standalone`, colors `#05001f`, `scope /`, icons 192/512 (any + maskable), screenshots desktop/mobile.
- **Service worker** `/build/sw.js` (scope `/build/`): `skipWaiting()` + `clientsClaim()` + `precacheAndRoute([...54 assets...])` + `cleanupOutdatedCaches()`. Precache covers **every** SPA chunk/CSS/font/wasm + `manifest.webmanifest` (hash `cc59ff20b50dcd0673eaddbc4067e003`).
- **Registration**: workbox-window `Workbox('/build/sw.js', {scope:'/build/', type:'classic'})`, `immediate:true`; update flow — `waiting` → prompt → `messageSkipWaiting()`; `installed`/`activated`/`controlling` events trigger reload or offline-ready callback (`VITE_*` booleans `Bz/Hz/Uz` control dev mode).
- **Worker path patch**: `window.Worker` rewrites `/assets/assets/` and `/build/assets/assets/` → `/build/assets/` so the decode worker resolves under the Laravel `/build` base.
- The SW precaches API shells? No — only build assets; API data is not cached.

---

## 20. External services & integrations

| Service | Usage | Direction |
|---|---|---|
| Cloudflare Insights (RUM) | `beacon.min.js` with site token; `/cdn-cgi/rum` POSTs | out |
| Laravel Boost logger | console/error capture → `/_boost/browser-logs` | out |
| `techport-iq.com` | credits on login, report print, portal | link |
| `weasis://` | external Weasis DICOM viewer launch | out (OS protocol) |
| `radiant://` | external RadiAnt launch | out (OS protocol) |
| DICOM node (configurable) | via `/api/dicom-web` proxy | server-side |

---

## 21. Security observations

*(Observations of shipped behavior; severity judgments left to the owner.)*

1. **Bearer token embedded in a custom-protocol URL** (Weasis launcher). The full `Authorization` header travels inside `weasis://?…` — such URLs typically land in OS command lines/logs and cannot set headers natively; it leaks long-lived credentials outside the browser.
2. **Laravel Boost browser-logger active in production**: all console output (including app `console.error` payloads with response data) is POSTed to `/_boost/browser-logs` unauthenticated — a log/PHI sink worth disabling or gating.
3. **Remember-me is client-side only**: "logging out" on browser close relies on deleting a JS-visible cookie + storage; the server token remains valid until revoked. Compromise of the machine keeps access.
4. **`console`-visible token**: `auth-token` sits in `localStorage` (XSS-readable). No CSRF token is used for `/api` (stateless bearer — fine, but makes logout/impersonate CSRF-relevant only via stolen tokens).
5. **Unknown `/api/*` paths return the SPA HTML with 200** — unexpected behavior for API consumers; error handling depends on the client.
6. **PACS credentials stored/readable** through `GET /settings/pacs` (password round-trips to the UI) — requires `PacsSetting.view`, but returning the password to the client is a risk surface.
7. **Weak demo credentials** (`doctor`/`12345678`) observed on a live deployment; the account also holds broad permissions.
8. **PHI in list APIs**: `/api/studies` returns patient names/IDs/ages to any `Study.view` holder with no row-level (patient-level) access control beyond role — typical for PACS, but list-level exposure is broad (observed for the `doctor` role and even audit scope of the share token is limited to one study).
9. **Guest share flow** is well-scoped (one study, `Study.view`-like guest) — good pattern; share links are UUID ids (not guessable).
10. **No observed rate limiting signals** client-side (login 422 has no lockout UI).
11. PWA precaches the whole SPA to disk — fine, but means old chunks persist until SW update.

---

## 22. Key reconstructed source (clean pseudocode)

### 22.1 Auth store (de-minified)

```js
const TOKEN_KEY = 'auth-token', USER_KEY = 'auth-user';

const api = axios.create({ baseURL: '/api' });
const stored = restoreSession();
if (stored) api.defaults.headers.common.Authorization = `Bearer ${stored}`;
api.defaults.headers.common['X-Locale'] = window.App?.locale || 'en';

api.interceptors.response.use(r => r, error => {
  if (error.response?.status === 401) {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY);
    localStorage.removeItem('auth-remember');
    document.cookie = 'auth-session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    sessionStorage.clear?.();
    delete api.defaults.headers.common.Authorization;
    token.value = null; user.value = null;
  } else if (!error.response || error.response.status !== 422) {
    toast.danger(error.response?.data?.message || error.message || 'An unexpected error occurred.', 'Error');
  }
  return Promise.reject(error);
});

function useAuth() {
  async function login(username, password, remember) {
    try {
      const { data } = await api.post('auth/login',
        { username, password, device_name: deviceUuid() });
      setSession(data.token, data.user, remember);
      return { success: true, user: data.user };
    } catch (e) { return { success: false, error: e.response?.data?.message || e.message }; }
  }
  async function fetchUser() { /* GET auth/user → setSession(token, data.data) */ }
  async function logout()  { try { token.value && await api.post('auth/logout'); } finally { clear(); } }
  async function impersonate(id) { /* POST users/{id}/impersonate → setSession(data.token, data.user) */ }
  return { user, token, isAuthenticated, login, logout, fetchUser, impersonate, setSession };
}

function usePermissions() {
  const { user } = useAuth();
  return {
    hasPermission: p => !!user.value && user.value.permissions?.includes(p) ?? false,
    hasAnyPermission: ps => !!user.value && ps.some(p => user.value.permissions?.includes(p)),
    hasAllPermissions: ps => !!user.value && ps.every(p => user.value.permissions?.includes(p)),
  };
}
```

### 22.2 Report document codec

```js
const PAGE_BREAK = '<!-- PAGE_BREAK -->';
const MANUAL_PAGE_BREAK = '<!-- MANUAL_PAGE_BREAK -->';

function encode({ header, bodyPages, footer }) {
  const body = bodyPages?.length ? bodyPages.join('\n' + PAGE_BREAK) : body;
  return [
    '<!-- REPORT_HEADER_START -->', `<div class="report-header">${header}</div>`, '<!-- REPORT_HEADER_END -->',
    '<!-- REPORT_BODY_START -->', `<div class="report-body">${body}</div>`, '<!-- REPORT_BODY_END -->',
    '<!-- REPORT_FOOTER_START -->', `<div class="report-footer">${footer}</div>`, '<!-- REPORT_FOOTER_END -->',
  ].join('\n');
}

function decode(html) {
  const sect = (re) => html.match(re)?.[1]?.trim() ?? '';
  const strip = (s, cls) => s.match(new RegExp(`^\\s*<div[^>]*class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]*?)<\\/div>\\s*$`, 'i'))?.[1] ?? s;
  const header = strip(sect(/REPORT_HEADER_START([\s\S]*?)REPORT_HEADER_END/), 'report-header');
  const body   = strip(sect(/REPORT_BODY_START([\s\S]*?)REPORT_BODY_END/), 'report-body');
  const footer = strip(sect(/REPORT_FOOTER_START([\s\S]*?)REPORT_FOOTER_END/), 'report-footer');
  return { header, body, bodyPages: body.split(/<!--\s*PAGE_BREAK\s*-->/).map(s => s.trim()), footer };
}

function renderTemplate(tpl, vars) {           // {{ var }} with case-insensitive fallback
  return tpl?.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (m, k) =>
    k in vars ? vars[k] ?? '' :
      Object.entries(vars).find(([vk]) => vk.toLowerCase() === k.toLowerCase())?.[1] ?? '') ?? '';
}
```

### 22.3 Study share dialog (core)

```js
async function createShare(uid, expiry) {          // expiry: '1day'|'7days'|'30days'|'never'
  const expiresAt = expiry === 'never' ? null : addDays(new Date(), {1day:1,7days:7,30days:30}[expiry]);
  const { data } = await api.post('study-shares', { studyInstanceUid: uid, expiresAt });
  const link = data.data.shareLink;                 // https://…/portal/<shareId>
  const qr = await QRCode.toDataURL(link, { width: 600, margin: 1 });
  return { link, qr };
}

function launchExternalViewer(viewer, uid, token) {
  if (viewer === 'web')  return router.push(`/studies/${uid}/viewer`);
  if (viewer === 'weasis') {
    const cmd = `$dicom:rs --url "${location.origin}/api/dicom-web" -r "studyUID=${uid}"`
              + (token ? ` -H "Authorization: Bearer ${token}"` : '');
    location.href = `weasis://?${encodeURIComponent(cmd)}`;
  }
  if (viewer === 'radiant') location.href = `radiant://?n=pstv&v=0020000D&v=${uid}`;
}
```

### 22.4 Portal boot (public share)

```js
onMounted(async () => {
  const [settings, share] = await Promise.all([
    api.get('portal-settings').catch(() => FALLBACK_ARABIC_DEFAULTS),
    api.post(`study-shares/${shareId}/generate-token`).then(r => r.data),
  ]);
  setSession(share.token, share.user);              // guest login
  const delay = settings.data?.redirectDelay ?? 3;
  if (delay <= 0) return router.push(`/studies/${share.studyInstanceUid}/viewer`);
  animate(0 → 100% over delay seconds, then router.push(viewer));
});
```

---

## 23. Open-source rebuild blueprint

A from-scratch repository layout that reproduces everything documented above:

```
spacs/
├─ app/ (Laravel 11/12)
│  ├─ app/Http/Controllers/Api/{AuthController,UserController,RoleController,
│  │     PermissionController,PreferenceController,StudyController,
│  │     ReportController,StudyShareController,PrintTemplateController,
│  │     ReportTemplateController,PacsSettingController,PortalSettingController,
│  │     DicomWebProxyController,EditorUploadController}
│  ├─ app/Models/{User,Role,Permission,Study,Report,ReportRevision,
│  │     StudyShare,PrintTemplate,ReportTemplate,Preference,PacsSetting,PortalSetting}
│  │     (ULID keys; User: roles[] json or pivot; permissions aggregated from roles)
│  ├─ app/Policies/*        ← Resource.action / Own / Any checks
│  ├─ routes/api.php        ← routes of §14 (+ /language/{locale} web route + SPA fallback)
│  ├─ config/{sanctum,tenancy}.php, app/Providers serving window.App
│  └─ resources/views/spa.blade.php  ← index.html shell (window.App injection, boost logger toggle)
├─ resources/js (Vue 3 SPA — mirrors every chunk of §5 1:1)
│  ├─ router/index.ts               ← §12 table + guards
│  ├─ api/client.ts                 ← axios §22.1
│  ├─ composables/{auth,permissions,preferences,toast,confirm,locale,report,printTemplates}.ts
│  ├─ layouts/{AppShell(sidenav|rail|topbar),FullScreen}.vue
│  ├─ components/ui/*               ← Button, Input, Select, DatePicker(range+presets), Table,
│  │     Badge, Dialog, DropdownMenu, Pagination, Avatar, ToastHost, Skeleton…
│  ├─ components/studies/{StudyFilters,ShareStudyDialog}.vue
│  ├─ components/viewer/{StudySidebar,StudyViewport,ViewerHeader,ToolSelector,
│  │     ViewportManipulators,LayoutSwitcher,PresetSelector,CineControls,
│  │     MouseSettingsDialog,ViewportPlaneSwitcher,ViewerReportPanel}.vue
│  ├─ components/reports/{ReportCommandBar,RevisionHistory,ClinicalTemplatesDialog,PrintDialog}.vue
│  ├─ pages/… (every route of §12)
│  └─ dicom/ (cornerstone3D init, series loader §17, codecs/worker wiring)
├─ public/build/… (vite build, vite-plugin-pwa)
└─ storage/app/public/assets/favicon/…
```

**Rebuild order (each step independently testable):**
1. Laravel skeleton + ULID models + Sanctum tokens + `/api/auth/*` (§10).
2. Permissions catalogue + policies (§11) + `GET /permissions`.
3. Users/Roles CRUD + matrix (§14.2).
4. SPA shell: Vite + Tailwind tokens (§9) + router table/guards (§12) + AppShell + login.
5. Studies API (list/detail with modality/date filters, pagination) + studies page.
6. DICOMweb proxy + viewer (Cornerstone3D; codecs; thumbnails; tools; MPR; cine).
7. Reports: document codec (§22.2), Tiptap paginated editor, draft/finalize/amend + revisions.
8. Print templates (variables §16.10) + print pipeline + QR.
9. Report templates + share flow (guest sessions, portal page).
10. Preferences, PACS/Portal settings, welcome dashboard, PWA build.
11. i18n (en/ar tables served into `window.App`, `/language/{locale}`).

---

## 24. Analysis limitations & unknowns

- **Backend not directly observed** — Laravel-side behavior is inferred from HTTP contracts (shapes, status codes, headers) and frontend error handling. Exact middleware, DB schema, and job queues are unknown.
- **Write flows not exercised** against the live hospital instance (only login + reads; no study/report mutations were performed during analysis).
- DICOM node type behind `/api/dicom-web` (Orthanc/Dcm4chee/custom) is unknown; the settings surface (AE title + WADO base URL) suggests a generic DICOM gateway.
- The complete `GET /api/permissions` list was not fetched live (the full catalogue in §11 is reconstructed from enum constants + observed grants; individual `Own/Any` pairs for every resource are certain, exact backend `Report.delete*` naming is inferred).
- Some viewer internals (exact tool-group binding of mouse buttons, MPR volume interpolation settings) are documented from class/architecture evidence, not runtime observation.
- E2E evidence (screenshots/DOM) was captured for the login→studies flow only.

---

## 25. Appendix A — Evidence ledger (REA)

| Step | Tool | Evidence ID | Notes |
|---|---|---|---|
| Authenticated browser scenario (login → studies) | `capture_browser_scenario` (launch, headless Chrome 156) | `ev_8b950dc69ca35d9c2bbf70fd2f58c336050af249e3c57f5936373f3c28d9777d` | 107 requests / 103 responses / 210 network-content records; complete response bodies |
| Same scenario re-run via CLI for canonical capture file | `rea capture-browser-scenario` | `ev_23cb6acbaf80415ef7596f6d2404145905736f0176ecb257007af0a86d2b516d` | saved to `spacs/capture-plain.json` |
| Script export from capture | `export_web_scripts` | `ev_62995c9c06d03dc3bf42e31ba71d53e5cd2822c256ef26d27c480ed8d8aa61b2` | 19 scripts verified |
| Full static JS application analysis | `analyze_javascript_application` (directory, summary) | parent `ev_a7875750ffc18970ba10173cd7fa83895a7f3388e0de53a14cc884ca5daadbea` (summary `ev_957dc87b…`) | 45 relevant files, 1,365,519 AST nodes, 1,161 findings; partial semantic graphs on 3 oversized files (heap-bound), all static facts retained |
| Module inventory pages | `inspect_analysis_view` (modules page 0) | — | 182 graph nodes over 283 total |

Session artifacts (local): `AppData\Local\Temp\opencode\spacs\` — `capture-plain.json` (canonical capture), `scripts/` (REA-verified export), `app/` (complete asset extraction), `inventory.json` (endpoint/permission/storage scan), per-page de-minification windows.

---

## 26. Appendix B — Extracted artifact hashes

From the REA export manifest (capture `ev_23cb6acb…`):

| URL | SHA-256 (of retained bytes) | Bytes |
|---|---|---|
| `/build/assets/app-DnvMERK5.js` | `84317381cdbc0d0553b46a3d1548257e0ef4c8824597bca9f1d201ad04efccf0` | 788,603 |
| `/build/assets/composables-DYpJyAbE.js` | `4ada347b2bc1d8e69a617c3f99e7f99492cc0502e6016baaddee9d8da89915e8` | 268,436 |
| `/build/assets/rolldown-runtime-C0FnF6B9.js` | `6ea741edd57df13b1e276546ba232f99eead3ca03450eff1d515a1186295b228` | 1,291 |
| `/build/assets/workbox-window.prod.es5-Bd17z0YL.js` | `3c61ab0625053d6ea030b089df90f8c34ae313ddbfc139c0a882f5df960c6224` | 5,653 |
| `/build/assets/login-DB3m4l4l.js` | `f02a9b5009aeaf61e3c326bb22f8915b8b42c79b8c3eb2226840cbf715771be5` | 3,955 |
| Cloudflare beacon (`static.cloudflareinsights.com`) | `fba4dc26fb998072d185e845feb53f7c137307ceed8cc4fa7c4e8f84960e2442` | 31,853 |

Manifest digests: export manifest `18154` bytes; capture file `browser-capture.json` SHA-256 recorded by REA at export time (`capture_sha256` in manifest).

---

*Generated from REA session evidence on 2026-10-30. All API request/response samples in this document use placeholder values for patient data; live credentials and tokens are redacted (`[REDACTED]`).*
