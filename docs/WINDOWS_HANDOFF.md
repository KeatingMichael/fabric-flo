# Fabric Flo — Windows handoff (paste into Cursor chat)

**Copy everything below the line into a new Cursor chat on Windows after cloning the repo.**

---

I'm continuing Fabric Flo setup on Windows 11. Mac Part 0 is **done**. Please help me work top-down from Part 1.

## Project

- **App:** Fabric Flo — phone-first PWA + Capacitor native app for film/TV productions (fabric + matching bag pairs, Invite Codes, scan log, rental inventory).
- **Repo:** `https://github.com/KeatingMichael/fabric-flo`
- **Live site:** `https://fabricflo-app.com`
- **App ID:** `app.fabricflo.tracker`
- **Supabase project ref:** `zfrekjlqpkipuoliptpd`

## Completed on Mac (Part 0)

- [x] Supabase Legacy **anon** key + project URL saved in password manager / Apple Notes (not `sb_publishable_`)
- [x] `.env` created and tested locally — sign-in works, **Virgin River** production loads at `/app`
- [x] `npm run dev` verified (`http://localhost:5173` marketing, `/app` app)
- [x] Git pushed — `main` clean and up to date with `origin/main`
- [x] Supabase Edge: `GEMINI_API_KEY` secret set; `label-ocr` function deployed
- [x] Roadmap docs in repo: `docs/COMPLETE_ROADMAP.md`, PDFs in `docs/`

## What I need on Windows (Part 1 first)

1. Install: Git, Node **20 LTS**, GitHub Desktop (optional), Cursor; Android Studio can wait until Part 5.
2. Clone `KeatingMichael/fabric-flo` (GitHub Desktop or `git clone`).
3. `npm install`
4. Copy `.env.example` → `.env` and paste values from my password manager:
   - `VITE_SUPABASE_URL=https://zfrekjlqpkipuoliptpd.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=` *(full `eyJ...` Legacy anon key — in Notes, not in git)*
   - `VITE_FABRIC_FLO_BACKEND=normalized`
   - `VITE_PUBLIC_APP_URL=https://fabricflo-app.com`
   - `VITE_SUPPORT_EMAIL=support@fabricflo.app`
   - `VITE_PRIVACY_EMAIL=privacy@fabricflo.app`
5. `npm run dev` → confirm `/` and `/app` work and I can sign in.

**Guides:** `docs/TRANSFER_TO_WINDOWS.md`, `docs/COMPLETE_ROADMAP.md`

## After Part 1 — priority order

| Step | What | Notes |
|------|------|-------|
| Part 2 | Verify live backend + Netlify | Likely already done — check boxes, don't rebuild from scratch |
| Part 3 | Apple Developer ($99/yr) + Google Play ($25) | Start early — approvals take days |
| **Part 6** | **Codemagic → TestFlight (iOS)** | **Priority for label scanning** — native Apple Vision, not Safari |
| Part 5 | Android Studio → signed `.aab` | Google Play internal testing |
| Submit | Both stores | `docs/FINISH_AND_SUBMIT_CHECKLIST.md` |

## Product decisions (don't re-debate)

- Terminology: **Invite Code** (never "join code"); one inventory row = **fabric + bag pair**.
- **Crew** should scan labels in the **native iPhone app (TestFlight/App Store)**, not Safari web.
- Safari label OCR uses cloud round-trip (Gemini via `label-ocr` edge) — slower; TestFlight is the real scan test.
- Windows builds **Android**; iOS via **Codemagic** (`docs/CODEMAGIC_SETUP.md`, workflow `ios-release`).

## Key paths

| Area | Path |
|------|------|
| Env template | `.env.example` |
| Cloud sync | `src/lib/cloudRepository.ts` |
| Label OCR client | `src/lib/labelOcrCloud.ts` |
| Edge OCR | `supabase/functions/label-ocr/` |
| Native iOS Vision | `ios/App/App/FabricLabelOcrPlugin.swift` |
| SQL bundle | `supabase/APPLY_ALL_MIGRATIONS.sql` |

## Ask the agent to

Walk me through **Part 1 step by step** on Windows, then verify Part 2 checklist items, then help set up **Codemagic + TestFlight** for label scan testing on iPhone.

Do **not** commit `.env`. Do not commit unless I explicitly ask.
