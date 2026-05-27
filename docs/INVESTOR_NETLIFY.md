# Fabric Flo on Netlify (investor demo)

Get a **public HTTPS URL** you can share in pitch decks and live demos.

## What investors will see

| URL | Content |
|-----|---------|
| `https://YOUR-SITE.netlify.app/` | Marketing landing page |
| `https://YOUR-SITE.netlify.app/app` | Full app (scan, inventory, log) |
| `https://YOUR-SITE.netlify.app/launch` | Env / readiness checklist |

**Minimum for a strong demo:** set Supabase env vars (below) so sign-in, productions, and scanning work on the live URL.

---

## Path A — Connect GitHub (recommended)

Keeps the site updated whenever you push.

1. **Commit and push** this repo to GitHub (private or public).
2. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**.
3. Choose your GitHub repo → branch `main`.
4. Netlify reads **`netlify.toml`** automatically (`npm run build` → `dist`).
5. **Before the first deploy finishes:** **Site configuration → Environment variables** → add the table from [NETLIFY_DEPLOY.md](./NETLIFY_DEPLOY.md).
6. Set **`VITE_PUBLIC_APP_URL`** to your Netlify URL (e.g. `https://fabric-flo.netlify.app`) → **Trigger deploy** (clear cache).
7. In Supabase **Authentication → URL configuration**, set Site URL and Redirect URLs to the same Netlify origin.

Share: `https://YOUR-SITE.netlify.app/` and `https://YOUR-SITE.netlify.app/app`.

---

## Path B — Deploy from this Mac (no GitHub)

```bash
cd "/Users/MichaelKeating/Desktop/IATSE/FABRIC FLO APP"
npm install
npx netlify-cli login          # once — opens browser
npx netlify-cli init           # link or create a site on your Netlify account
cp .env.example .env           # fill Supabase keys locally
npx netlify-cli env:import .env
npm run netlify:deploy
```

After the first deploy, copy the **production URL** into Netlify env as `VITE_PUBLIC_APP_URL`, update Supabase auth URLs, then run `npm run netlify:deploy` again.

---

## Env vars checklist (Netlify UI)

| Variable | Required for live demo |
|----------|-------------------------|
| `VITE_SUPABASE_URL` | Yes |
| `VITE_SUPABASE_ANON_KEY` | Yes |
| `VITE_FABRIC_FLO_BACKEND` | `normalized` |
| `VITE_PUBLIC_APP_URL` | Yes — your Netlify URL |
| `VITE_SUPPORT_EMAIL` | Yes (can use your email) |
| `VITE_PRIVACY_EMAIL` | Yes |

Database: run `npm run supabase:bundle` and paste **`supabase/APPLY_ALL_MIGRATIONS.sql`** in Supabase SQL Editor (see [BACKEND_SETUP.md](./BACKEND_SETUP.md)).

---

## Demo script (5 minutes)

1. Open `/` — explain the product positioning.
2. **Open app** → sign in (or create account).
3. Create a production → add a fabric row → **Start scanning** (HTTPS required; works on Netlify).
4. Show **Log** and rental list **Download** (CSV + PDF).

---

## Custom domain (optional)

Netlify → **Domain management** → add `app.yourbrand.com` → update `VITE_PUBLIC_APP_URL` and Supabase redirect URLs → redeploy.
