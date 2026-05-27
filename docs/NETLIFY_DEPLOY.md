# Deploy Fabric Flo on Netlify

This repo is already configured via **`netlify.toml`** (build command, `dist` publish folder, SPA redirects).

## 1. Connect the site

1. Log in at [app.netlify.com](https://app.netlify.com).
2. **Add new site → Import an existing project** (GitHub/GitLab/Bitbucket) or drag-and-drop after a local `npm run build`.
3. Netlify should detect:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. If it does not, set those manually (they match `netlify.toml`).

## 2. Environment variables (required for production)

In **Site configuration → Environment variables**, add:

| Variable | Example | Notes |
|----------|---------|--------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | **anon public** key only |
| `VITE_FABRIC_FLO_BACKEND` | `normalized` | Multi-user + invites |
| `VITE_PUBLIC_APP_URL` | `https://your-site.netlify.app` | **Your live Netlify URL** (or custom domain) — no trailing slash |
| `VITE_SUPPORT_EMAIL` | `support@yourdomain.com` | Store listing + in-app |
| `VITE_PRIVACY_EMAIL` | `privacy@yourdomain.com` | Deletion requests |

Optional after you deploy the Edge Function:

| Variable | Value |
|----------|--------|
| `VITE_ACCOUNT_DELETE_EDGE` | `1` |

Redeploy after changing env vars (Vite bakes them in at **build** time).

### Custom domain

When you add a custom domain (e.g. `app.fabricflo.com`), update:

- `VITE_PUBLIC_APP_URL` → `https://app.fabricflo.com`
- Trigger **Deploys → Trigger deploy → Clear cache and deploy site**

## 3. Supabase Auth (required for sign-in)

In Supabase **Authentication → URL configuration**:

| Field | Value |
|-------|--------|
| **Site URL** | `https://your-site.netlify.app` (or custom domain) |
| **Redirect URLs** | `https://your-site.netlify.app/**` |

Add the custom domain URLs too if you use one.

Enable **Email** provider under Authentication → Providers.

## 4. Database migrations

In Supabase **SQL Editor**, run each file in order:

`supabase/migrations/001_user_app_state.sql` … through `008_fabric_flo_delete_account.sql`

## 5. Verify after deploy

1. Open `https://your-site.netlify.app/launch` — env checks should be green.
2. **Home → Cloud account** — sign up / sign in.
3. Create a production (normalized mode registers on server).
4. Test **Scan** (camera needs HTTPS — Netlify provides this).
5. Privacy link for stores: `https://your-site.netlify.app/privacy`

## 6. Password reset emails

Reset links use `VITE_PUBLIC_APP_URL` as the redirect target. If resets land on the wrong host, fix that variable and redeploy.

## 7. Branch deploys (optional)

Preview URLs look like `https://deploy-preview-123--your-site.netlify.app`. For previews, either:

- Use a separate Supabase project, or  
- Accept that preview builds may point auth at production URLs if `VITE_PUBLIC_APP_URL` is production-only.

## 8. Local vs Netlify

| | Local `npm run dev` | Netlify |
|--|---------------------|---------|
| Env | `.env` file | Netlify UI variables |
| HTTPS | `http://localhost:5173` | Automatic HTTPS |
| PWA | Dev SW disabled in Vite config | Full PWA in production build |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank page after refresh on `/inventory` | `netlify.toml` redirect should be present; redeploy |
| Cloud sign-in fails | Supabase redirect URLs + env vars on Netlify |
| “Normalized cloud mode” alert | Run migrations; create production while signed in |
| Env checks red on `/launch` | Set all `VITE_*` vars; clear cache and redeploy |
| Build fails on Netlify | Use Node 20 (`.nvmrc` in repo); check build log |

## Commands (optional CLI)

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify env:import .env   # never commit .env
netlify deploy --prod
```
