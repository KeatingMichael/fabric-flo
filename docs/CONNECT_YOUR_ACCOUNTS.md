# Connect Fabric Flo to your GitHub + Netlify accounts

Your code is on **this Mac only** until you push to GitHub. Netlify will not show a Fabric Flo site until you import that repo (or run a deploy).

| Account | Username / login | What to create |
|---------|----------------|----------------|
| **GitHub** | `KeatingMichael` | Repo: **`fabric-flo`** |
| **Netlify** | `electriccreations@gmail.com` | New site from that GitHub repo |

---

## Quick setup (about 5 minutes)

### 1. Create GitHub repository

1. Open: **[Create fabric-flo on GitHub](https://github.com/new?name=fabric-flo&description=Fabric+Flo+film+fabric+and+bag+tracker)**
2. Owner: **KeatingMichael**
3. Leave **empty** — do not add README, .gitignore, or license.
4. Click **Create repository**.

### 2. Push this project from Terminal

```bash
cd "/Users/MichaelKeating/Desktop/IATSE/FABRIC FLO APP"
git remote add origin https://github.com/KeatingMichael/fabric-flo.git
git push -u origin main
```

(GitHub may ask you to sign in in the browser the first time.)

Or run the guided script:

```bash
bash scripts/connect-github-and-netlify.sh
```

After push, refresh [github.com/KeatingMichael?tab=repositories](https://github.com/KeatingMichael?tab=repositories) — you should see **fabric-flo**.

### 3. Add site on Netlify

1. [app.netlify.com](https://app.netlify.com) (team **MK** / electriccreations).
2. **Add new site** → **Import an existing project** → **GitHub**.
3. If asked, **authorize Netlify** to access `KeatingMichael` repos.
4. Select **`fabric-flo`**.
5. Confirm build settings (from `netlify.toml`):
   - Build: `npm run build`
   - Publish: `dist`
6. **Deploy site** (first build may work without env; cloud needs vars below).

### 4. Environment variables + redeploy

**Site configuration → Environment variables** → add all from `.env.example`, then:

**Deploys → Trigger deploy → Clear cache and deploy site**

Set `VITE_PUBLIC_APP_URL` to your Netlify URL, e.g. `https://fabric-flo.netlify.app`.

### 5. Supabase auth URLs

In Supabase → **Authentication → URL configuration**:

- Site URL: `https://YOUR-NETLIFY-URL.netlify.app`
- Redirect URLs: `https://YOUR-NETLIFY-URL.netlify.app/**`

---

## Share with investors (phone, anywhere)

- `https://YOUR-SITE.netlify.app/` — marketing
- `https://YOUR-SITE.netlify.app/app` — app

**Not** `http://127.0.0.1:5173` — that only works on your Mac while `npm run dev` is running.

---

## Optional: CLI deploy (no GitHub)

```bash
npx netlify-cli login
npx netlify-cli init
npm run netlify:deploy
```

Pick team **MK** when prompted. You still need env vars in the Netlify UI.
