# Fabric Flo

Phone-first app for tracking film fabrics and bags — **one physical piece per row**, each with its own **dynamic QR** for scans, plus locations and logs. Works offline on set; optional **Supabase** cloud sync with email sign-in.

## Quick start

```bash
npm install
npm run dev
```

Open the printed URL (use the **Network** address to test on a phone on the same Wi‑Fi).

- **`/`** — public marketing site  
- **`/app`** — sign in, productions, and full app  

See **[docs/WEBSITE.md](docs/WEBSITE.md)** for deploying the website + web app together.

## Netlify (share with investors)

**[docs/INVESTOR_NETLIFY.md](docs/INVESTOR_NETLIFY.md)** — connect this repo at [app.netlify.com](https://app.netlify.com) or run `npx netlify-cli login` then `npm run netlify:deploy`.

## Use with Claude / Cursor

- **Cursor**: rules in `.cursor/rules/` and `AGENTS.md` load automatically — Claude follows Fabric Flo's terminology and backend model in this repo.
- **Claude.ai Projects**: run `npm run knowledge:export`, then upload `docs/export/Fabric_Flo_Knowledge_Pack.md`. Product language lives in **[docs/FABRIC_FLO_GLOSSARY.md](docs/FABRIC_FLO_GLOSSARY.md)**.

## Cloud sync (Supabase)

See **[docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md)** for the full checklist.

1. Create a project at [Supabase](https://supabase.com/).
2. Run `npm run supabase:bundle` and paste **`supabase/APPLY_ALL_MIGRATIONS.sql`** in the SQL Editor (or run `001`–`009` one by one).
3. **Authentication → Providers:** enable **Email** (set “Confirm email” per your rollout).
4. Copy **Project URL** and **anon** key into `.env` (see `.env.example`).
5. Set `VITE_FABRIC_FLO_BACKEND=normalized` for multi-user productions and invites.
6. Restart `npm run dev`. Use **Home → Cloud account** (Terms + Privacy consent on sign-up).

Without `.env`, the app runs on-device only (`localStorage`).

### Smoke test: coordinator, invite, shared log

With Supabase + `VITE_FABRIC_FLO_BACKEND=normalized` (see above):

1. **Browser A:** sign up / sign in → **Home** → create a production → add at least one place and one inventory row.
2. **Browser A:** **Crew invites** → create invite code → copy it.
3. **Browser B (incognito):** sign up / sign in → **Crew invites** → paste code → **Accept invite**.
4. **Browser B:** open the show, **Scan** → save a move to the log.
5. **Browser A:** open **Log** (after a short sync) — the same scan entry should appear.

Run `npm run verify:release` for repo checks before deploy.

## Privacy & compliance

- **Legal checklist (PDF):** run `npm run legal:pdf` → `docs/Fabric_Flo_Legal_Checklist.pdf` (not legal advice — review with counsel)
- In-app **Privacy Policy** (`/privacy`) and **Terms** (`/terms`)
- Sign-up and sign-in require agreeing to both
- **Delete data on this device** and **Delete my account & cloud data** under Cloud account (migration `008`)
- Set `VITE_PUBLIC_APP_URL`, `VITE_SUPPORT_EMAIL`, and `VITE_PRIVACY_EMAIL` for production (App Store / Play URLs)

## Build (web / PWA)

```bash
npm run build
npm run preview
```

## Deploy on Netlify

This repo includes **`netlify.toml`**. Step-by-step: **[docs/NETLIFY_DEPLOY.md](docs/NETLIFY_DEPLOY.md)**.

Set `VITE_PUBLIC_APP_URL` to your live Netlify URL (or custom domain) and add the same URL in Supabase **Authentication → URL configuration**.

## iOS & Android (Capacitor)

See **[docs/STORE_RELEASE.md](docs/STORE_RELEASE.md)** (and [docs/MOBILE_RELEASE.md](docs/MOBILE_RELEASE.md)). After `npm run build`:

```bash
npm run cap:sync
npm run cap:ios    # or cap:android
```

## Move to Windows + ship to the app stores

- **[docs/TRANSFER_TO_WINDOWS.md](docs/TRANSFER_TO_WINDOWS.md)** — move development to a Windows 11 PC (clone from GitHub; manual/USB fallback). PDF: `docs/Fabric_Flo_Transfer_To_Windows.pdf`.
- **[docs/FINISH_AND_SUBMIT_CHECKLIST.md](docs/FINISH_AND_SUBMIT_CHECKLIST.md)** — Windows-aware checklist to finish Apple + Google Play. PDF: `docs/Fabric_Flo_Finish_And_Submit_Checklist.pdf`.
- **[codemagic.yaml](codemagic.yaml)** — cloud builds for **iOS** (no Mac required) and Android.
- Regenerate the PDFs anytime with `npm run guides:pdf`.

## Git

This repo is intended to live in **this project folder only**. Add a remote on GitHub/GitLab and push:

```bash
git remote add origin https://github.com/YOUR_ORG/fabric-flo.git
git push -u origin main
```

Use **private** repositories for production inventory patterns and PINs stored in exported data.
# fabric-flo
