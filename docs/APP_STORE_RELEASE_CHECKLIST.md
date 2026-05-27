# Fabric Flo — App Store & Google Play Release Checklist

**From UI-complete to published apps**  
Generated for operators · May 2026 · Not legal advice

Use this with the detailed guides in the repo: `docs/STORE_RELEASE.md`, `docs/MOBILE_RELEASE.md`, and the in-app **Rollout guide** (`/launch-checklist`).

---

## Phase 1 — Production backend & web host (do first)

Stores require a **live Privacy Policy URL** and HTTPS for password reset.

- [ ] **Supabase production project** — run SQL migrations `001` through `009` (or paste `supabase/APPLY_ALL_MIGRATIONS.sql` from `npm run supabase:bundle`).
- [ ] **Production environment variables** on your host (Netlify, Vercel, etc.):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_FABRIC_FLO_BACKEND=normalized`
  - `VITE_PUBLIC_APP_URL` (e.g. `https://app.fabricflo.com`)
  - `VITE_SUPPORT_EMAIL` and `VITE_PRIVACY_EMAIL`
- [ ] **Deploy web build** (`npm run build`) so these URLs work:
  - `https://YOUR_DOMAIN/privacy`
  - `https://YOUR_DOMAIN/terms`
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
- [ ] **iOS Info.plist** — camera usage: *Fabric Flo uses the camera to scan QR codes on fabric and bag labels.*
- [ ] **Android AndroidManifest.xml** — `CAMERA` permission.
- [ ] **App icons** — 1024×1024 PNG (Apple, no alpha); adaptive icon (Android).
- [ ] **Version / build numbers** — bump each store submission.
- [ ] **Signing** — Apple certificates in Xcode; Android upload keystore (back up securely).

---

## Phase 4 — On-set testing (before store review)

- [ ] **TestFlight** (iOS) — internal testers with real QR codes and rental labels.
- [ ] **Play internal testing** (Android) — same crew and flows.
- [ ] **Offline test** — airplane mode → scan → place → online → sync completes.
- [ ] **Rental list & log** — Download and Upload (CSV + PDF) on phone.
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
| UI / flows | Largely complete | Final device QA |
| Cloud / invites | Built | Live Supabase + env + migrations |
| Legal pages | In-app routes | Public URLs + counsel review |
| Native shells | ios/ + android/ | Icons, signing, listings |
| Store accounts | — | Apple + Google enrollment |

---

## Helpful commands

```
npm run build
npm run cap:sync:full
npm run verify:release
npm run legal:pdf
npm run store:pdf
```

**Fabric Flo** — Film fabric & bag tracker for productions.
