# What you can finish in Cursor vs what needs you outside

## ✅ Accomplish in Cursor (code & docs in this repo)

| Item | Command / location |
|------|-------------------|
| Run & test the web app | `npm run dev` |
| Production web build | `npm run build` (use `all` permissions if PWA step fails in sandbox) |
| Regenerate legal PDF | `npm run legal:pdf` → `docs/Fabric_Flo_Legal_Checklist.pdf` |
| Sync native projects | `npm run cap:sync:full` (after build) |
| Open Xcode / Android Studio | `npm run cap:ios` / `npm run cap:android` (opens locally) |
| Edit Privacy / Terms / Help | `src/pages/PrivacyPage.tsx`, `TermsPage.tsx`, `HelpPage.tsx` |
| In-app launch checklist | `/launch` in the app |
| Deploy on **Netlify** | `netlify.toml` + [NETLIFY_DEPLOY.md](./NETLIFY_DEPLOY.md) — connect repo in Netlify UI |
| SQL migrations (files) | `supabase/migrations/001`–`009` or bundled `APPLY_ALL_MIGRATIONS.sql` — **you** paste into Supabase SQL Editor |
| Edge Function (code) | `supabase/functions/delete-account/` — **you** run `supabase functions deploy` |
| CI on GitHub | Push repo; `.github/workflows/ci.yml` runs build |

## ❌ Cannot complete only in Cursor (needs accounts, hardware, or counsel)

| Item | Why |
|------|-----|
| Apple Developer / App Store listing | Paid enrollment + App Store Connect in browser |
| Google Play listing | Play Console + one-time fee |
| Install on a real iPhone (TestFlight) | Full **Xcode** on your Mac, CocoaPods, Apple signing |
| Host HTTPS production URL | Vercel/Netlify/Cloudflare account — connect git, add env vars |
| Apply Supabase migrations | Your Supabase project dashboard or CLI with project credentials |
| Lawyer review | Licensed attorney |
| Trademark registration | USPTO / attorney |
| Business entity (LLC, etc.) | State filing |
| Insurance | Broker |
| Demo account for App Review | Create in **your** hosted Supabase + put credentials in review notes |

## Suggested “today in Cursor” order

1. `npm install` → `npm run dev` — click through `/launch` checklist in the app.  
2. Fill `.env` from `.env.example`; run migrations 001–009 in Supabase.  
3. `npm run build` → deploy `dist/` via Vercel or Netlify (see `vercel.json`).  
4. `npm run legal:pdf` — send PDF to your lawyer.  
5. `npm run cap:sync:full` → `npm run cap:ios` on your Mac when Xcode is installed.
