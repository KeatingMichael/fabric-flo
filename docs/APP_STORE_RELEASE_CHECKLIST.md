# Fabric Flo — App Store & Google Play Release Checklist

**From UI-complete to published apps**  
Generated for operators · May 2026 · Not legal advice

Use this with: `docs/STORE_RELEASE.md`, `docs/MOBILE_RELEASE.md`, `docs/BACKEND_SETUP.md`, `docs/INVESTOR_NETLIFY.md`, `docs/STORE_LISTING.md` (listing copy), `docs/APP_REVIEW_NOTES.md` (reviewer notes + demo account), and the in-app **Rollout guide** (`/launch-checklist`).

**Share with investors (phone, any location):** deploy to Netlify — `https://YOUR-SITE.netlify.app/` (marketing) and `/app` (product). Local `http://127.0.0.1:5173` only works on your Mac while `npm run dev` is running.

---

## Phase 1 — Production backend & web host (do first)

Stores require a **live Privacy Policy URL** and HTTPS for password reset.

- [ ] **Supabase production project** — run SQL migrations `001` through `009` (or paste `supabase/APPLY_ALL_MIGRATIONS.sql` from `npm run supabase:bundle`).
- [ ] **Netlify (or other host)** — connect GitHub at [app.netlify.com](https://app.netlify.com) or `npm run netlify:deploy` after `npx netlify-cli login` (see `docs/INVESTOR_NETLIFY.md`).
- [ ] **Production environment variables** on Netlify (Site configuration → Environment variables):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_FABRIC_FLO_BACKEND=normalized`
  - `VITE_PUBLIC_APP_URL` — your live Netlify URL (e.g. `https://fabric-flo.netlify.app`), no trailing slash
  - `VITE_SUPPORT_EMAIL` and `VITE_PRIVACY_EMAIL`
- [ ] **Redeploy** after setting env vars (Clear cache and deploy) — Vite bakes `VITE_*` at build time.
- [ ] **Supabase Auth URLs** — Site URL + Redirect URLs match your Netlify domain (`https://YOUR-SITE.netlify.app/**`).
- [ ] **Deploy web build** so these URLs work:
  - `https://YOUR_DOMAIN/` (marketing)
  - `https://YOUR_DOMAIN/app` (app)
  - `https://YOUR_DOMAIN/privacy`
  - `https://YOUR_DOMAIN/terms`
  - `https://YOUR_DOMAIN/launch` (env checklist)
- [ ] **Smoke test cloud flows** on two devices: sign in → Invite Code → crew joins → scan → shared log when online.
- [ ] Optional: deploy `delete-account` Edge Function; set `VITE_ACCOUNT_DELETE_EDGE=1` (see `docs/STORE_RELEASE.md`).

**Command:** `npm run verify:release`

---

## Phase 2 — Developer accounts & business basics

- [ ] **Apple Developer Program** — $99/year — [developer.apple.com](https://developer.apple.com)
- [ ] **Google Play Console** — $25 one-time — [play.google.com/console](https://play.google.com/console)
- [ ] **Support email** monitored for store listings and users.
- [ ] **Privacy / Terms review** — run `npm run legal:pdf`; share `docs/Fabric_Flo_Legal_Checklist.pdf` with your attorney.
- [ ] **Business entity, insurance, trademark** — as needed for your operation.

---

## Phase 3 — Native apps (Capacitor)

The repo includes `ios/` and `android/` projects. App ID: `app.fabricflo.tracker`.

- [ ] **Mac setup:** Node 18+, **Xcode** (iOS), **Android Studio** (Android).
- [ ] Build and sync:
  ```
  npm ci
  npm run build
  npm run cap:sync:full
  ```
- [x] **iOS Info.plist** — camera usage string set (`NSCameraUsageDescription`).
- [x] **Android AndroidManifest.xml** — `CAMERA` permission present.
- [x] **App icons** — generated for iOS + Android + PWA from `assets/logo.png` via `@capacitor/assets`. Master 1024×1024, no alpha. Re-run with `npx @capacitor/assets generate` after icon changes.
- [x] **Version / build numbers** — set to `1.0.0` (build 1 / versionCode 1). Bump for each future submission.
- [ ] **Signing** — Apple certificates in Xcode; Android upload keystore (back up securely). **(needs your Apple/Google accounts)**

---

## Phase 4 — On-set testing (before store review)

- [ ] **TestFlight** (iOS) — internal testers with real QR codes and rental labels.
- [ ] **Play internal testing** (Android) — same crew and flows.
- [ ] **Offline test** — airplane mode → scan → place → online → sync completes.
- [ ] **Rental list & log** — Download (CSV + PDF) and Upload on phone.
- [ ] **Fabric type catalog** — rolodex from `FABRIC LIST` xlsx (`npm run fabric-catalog:import` if you update the list).
- [ ] **Account deletion** and delete data on device.
- [ ] **Forgot password** email (requires correct `VITE_PUBLIC_APP_URL`).

---

## Phase 5 — Apple App Store Connect

- [ ] Create app — bundle ID: `app.fabricflo.tracker`
- [ ] Store listing: name, subtitle, description, keywords, category (Business or Productivity)
- [ ] **Privacy Policy URL:** `https://YOUR_DOMAIN/privacy`
- [ ] **Screenshots** — iPhone required; iPad if supporting tablets
- [ ] **App Privacy labels** — email, inventory/scans, camera for QR only; no tracking in v1
- [ ] **Age rating** — workplace tool; typically 4+
- [ ] **Xcode:** Archive → Upload to App Store Connect → Submit for review
- [ ] **Reviewer notes** — demo login; camera only on Scan tab

---

## Phase 6 — Google Play Console

- [ ] Create app; upload **signed App Bundle** (AAB)
- [ ] Store listing: descriptions, graphics, feature graphic
- [ ] **Privacy Policy URL** — same as Apple
- [ ] **Data safety form** — match Apple disclosures (email, content, encryption, deletion)
- [ ] **Content rating** questionnaire
- [ ] **Testing track** → production (staged rollout recommended)

---

## Phase 7 — After launch

- [ ] Monitor Supabase usage, errors, backups
- [ ] Process updates: fix → version bump → `npm run build` → `cap sync` → resubmit
- [ ] Periodic `npm audit` and dependency updates
- [ ] Update Privacy Policy if you add crash analytics or new data collection

---

## Quick readiness summary

| Area | In repo | You still need |
|------|---------|----------------|
| UI / flows | Complete (marketing `/`, app `/app`) | Final device QA |
| Cloud / invites | Built (migrations 001–009) | Live Supabase + Netlify env + SQL apply |
| Investor demo URL | `netlify.toml` + docs | Netlify site + env + redeploy |
| Legal pages | In-app routes | Public HTTPS URLs + counsel review |
| Native shells | ios/ + android/ + **icons & splashes generated** | Signing, build on your Mac |
| Listing copy | `docs/STORE_LISTING.md` drafted | Fill domain/email, capture screenshots |
| Reviewer notes | `docs/APP_REVIEW_NOTES.md` drafted | Create demo account on live backend |
| Store accounts | — | Apple + Google enrollment |

---

## Helpful commands

```
npm run build
npm run build:native   # Mac: build + icons + cap sync, then open Xcode/Android Studio
npm run cap:sync:full
npm run verify:release
npm run supabase:bundle
npm run netlify:deploy
npm run legal:pdf
npm run store:pdf
```

**Fabric Flo** — Film fabric & bag tracker for productions.
