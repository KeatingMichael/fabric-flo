# Fabric Flo — Backend setup (Supabase)

Do this **once per environment** (production; optional staging). The app cannot use crew invites or shared cloud sync until this is done.

## 1. Create a Supabase project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Save the **database password** securely
3. Wait until the project is healthy

## 2. Apply database migrations

**Option A — one file (easiest)**

```bash
npm run supabase:bundle
```

Open **`supabase/APPLY_ALL_MIGRATIONS.sql`** in the repo, copy all, paste into Supabase **SQL Editor** → **Run**.

**Option B — file by file**

Run each file in `supabase/migrations/` in order: `001` … `009`.

## 3. Authentication

**Authentication → Providers**

- Enable **Email**
- Choose whether **Confirm email** is required for your rollout

**Authentication → URL configuration**

| Field | Value |
|-------|--------|
| Site URL | Your live app URL, e.g. `https://app.fabricflo.com` |
| Redirect URLs | Same origin with wildcard, e.g. `https://app.fabricflo.com/**` |

Add Netlify preview URLs only if you use branch deploys with a separate Supabase project.

## 4. API keys → app environment

**Project Settings → API**

Copy into hosting env (Netlify/Vercel) and local `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...anon...
VITE_FABRIC_FLO_BACKEND=normalized
VITE_PUBLIC_APP_URL=https://YOUR_LIVE_HTTPS_URL
VITE_SUPPORT_EMAIL=you@yourdomain.com
VITE_PRIVACY_EMAIL=privacy@yourdomain.com
```

Redeploy after changing `VITE_*` (Vite bakes them at build time).

## 5. Verify

1. Deploy web app (see `docs/NETLIFY_DEPLOY.md` or `docs/WEBSITE.md`)
2. Open `https://YOUR_URL/launch` — env checks should pass
3. **Open app** → sign up → create production → **Crew invites** → create Invite Code
4. Second browser/incognito → accept invite → scan → both see log when online

## 6. Optional: full account deletion (auth user removed)

```bash
# Install Supabase CLI, link project, then:
supabase functions deploy delete-account --no-verify-jwt
```

Set in production `.env`:

```env
VITE_ACCOUNT_DELETE_EDGE=1
```

Without this, in-app deletion still wipes production data via `fabric_flo_delete_my_account` (migration `008`).

## What the backend provides

| Feature | Mechanism |
|---------|-----------|
| Email sign-in | Supabase Auth |
| Multi-crew productions | `productions` + `production_members` |
| Invite Codes | `fabric_flo_create_invite` / `fabric_flo_accept_invite` |
| Sync inventory & scans | `fabric_flo_pull` / `fabric_flo_push` |
| Rental house name | `productions.settings.rentalHouseName` (migration `009`) |
| Invite contact list | `productions.settings.inviteRecipients` (migration `009`) |
| Scan method (QR / label / manual) | `scan_events.scan_method` (migration `009`) |
| Handwritten label OCR (optional) | Edge Function `label-ocr` + **`GOOGLE_VISION_API_KEY`** (recommended) or `OCR_SPACE_API_KEY` (free fallback) — see [`docs/LABEL_OCR_SETUP.md`](LABEL_OCR_SETUP.md) |
| CSV inventory import | `fabric_flo_import_inventory_rows` |
| Account deletion | `fabric_flo_delete_my_account` + optional Edge Function |

## Local dev without cloud

Leave `.env` empty or omit Supabase keys — the app uses **localStorage** only. Invites and multi-device sync require step 4.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Sign-in fails | Check Auth URL config and `VITE_PUBLIC_APP_URL` |
| `version_conflict` on sync | Tap sync banner → pull latest or retry |
| Invites disabled | `VITE_FABRIC_FLO_BACKEND=normalized` and signed in |
| Rental house not syncing | Run migration `009` and redeploy app |
| RLS errors | Migrations `002`+ not applied |

See also: `docs/BACKEND_API.md`, `docs/SYNC.md`, `docs/STORE_RELEASE.md`.
