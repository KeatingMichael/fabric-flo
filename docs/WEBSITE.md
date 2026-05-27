# Fabric Flo — Website & web app

Fabric Flo is **one codebase** that ships as:

| Surface | What it is | URL (example) |
|---------|------------|----------------|
| **Public website** | Marketing landing | `https://fabricflo.com/` |
| **Web app** | Full product (sign-in, scan, inventory, log) | `https://fabricflo.com/app` |
| **Legal** | Store-required pages | `/privacy`, `/terms` |
| **Native** | Same web build inside Capacitor | App Store / Google Play |

There is no separate “website repo.” You deploy **`npm run build`** once to Netlify, Vercel, or any static host.

## Routes

| Path | Page |
|------|------|
| `/` | Marketing / landing |
| `/app` | Productions, account, crew invites (former home) |
| `/dashboard` | Today on set (requires active production) |
| `/scan`, `/inventory`, `/locations`, `/log` | Core workflows |
| `/privacy`, `/terms`, `/help`, `/launch`, `/licenses` | Legal & ops |

## Deploy the website (Netlify)

See **[NETLIFY_DEPLOY.md](./NETLIFY_DEPLOY.md)**. Summary:

1. Connect repo → build `npm run build` → publish `dist`
2. Set all `VITE_*` env vars (especially `VITE_PUBLIC_APP_URL` = your live URL)
3. Run Supabase migrations `001`–`008`
4. Supabase Auth → Site URL = your production URL

After deploy, verify:

- `https://YOUR_SITE/` — marketing page  
- `https://YOUR_SITE/app` — sign in and create a production  
- `https://YOUR_SITE/privacy` — privacy policy (for App Store)

## Custom domains (optional)

| Host | Typical use |
|------|-------------|
| `fabricflo.com` | Marketing at `/`, or redirect root → `/app` |
| `app.fabricflo.com` | Entire SPA (set `VITE_PUBLIC_APP_URL` here) |

If marketing and app share one domain, use a single Netlify site and one `VITE_PUBLIC_APP_URL`.

## Desktop & tablet

The web app is **mobile-first** (bottom nav, camera scan). It works in desktop browsers for coordinators; scanning needs a device with a camera.

## Regenerate PDFs

```bash
npm run store:pdf   # App Store release checklist
npm run legal:pdf   # Legal operator checklist
```
