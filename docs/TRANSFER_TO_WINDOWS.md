# Move Fabric Flo to your Windows 11 PC

**A plain-English, step-by-step guide. No prior experience assumed.**
Generated for the operator · June 2026

Your project now lives safely on GitHub at **`https://github.com/KeatingMichael/fabric-flo`**.
That changes everything: moving to a new computer is now a **download**, not a risky file copy.
Nothing on your Mac gets damaged — you are making a *fresh copy* on Windows.

> **What works where**
> - **Windows 11** → run the app, develop, and build/submit the **Android** app. ✅
> - **Apple (iOS)** → Apple requires a Mac *somewhere*. You do **not** need to own one — use
>   **Codemagic** (cloud Mac that builds from GitHub). See `docs/FINISH_AND_SUBMIT_CHECKLIST.md`.

---

## The big picture (3 steps)

1. Install three free tools on Windows (Git, Node 20, optionally Android Studio).
2. **Clone** (download) the project from GitHub with one command.
3. Run `npm install` then `npm run dev` and confirm the app opens.

That's it. The rest of this doc is just the detail for each step.

---

## Method A — GitHub (recommended, clean and safe)

### 1. Install the tools on Windows 11

Install these by downloading from the official sites (accept the default options):

| Tool | Link | Why |
|------|------|-----|
| **Git for Windows** | <https://git-scm.com/download/win> | Downloads the project and saves your changes |
| **Node.js 20 LTS** | <https://nodejs.org/en/download> | Runs the app (`.nvmrc` pins version **20**) |
| **GitHub Desktop** *(optional, easiest)* | <https://desktop.github.com> | Clone/push with buttons instead of typing |
| **Android Studio** *(only for Android builds)* | <https://developer.android.com/studio> | Builds the Android app + emulator |
| **VS Code or Cursor** *(to edit)* | <https://cursor.com> | Same editor experience as your Mac |

> Node tip: after installing, open a new terminal and run `node -v` — it should print `v20.x`.

### 2A. Clone with GitHub Desktop (no typing — easiest)

1. Open **GitHub Desktop** → **File ▸ Clone repository**.
2. Sign in to GitHub (the same `KeatingMichael` account).
3. Pick **`KeatingMichael/fabric-flo`** from the list.
4. Choose a local folder (e.g. `C:\Users\You\Documents`) → **Clone**.

You now have the whole project on Windows. Skip to **step 3**.

### 2B. Clone with the command line (alternative)

Open **Git Bash** (installed with Git) or **PowerShell** and run:

```bash
cd ~/Documents
git clone https://github.com/KeatingMichael/fabric-flo.git
cd fabric-flo
```

If it asks you to sign in, a browser window will pop up — click **Authorize**. (This is the same
sign-in you set up on the Mac; on Windows it's handled automatically by the Git Credential Manager,
so you should not have to deal with tokens again.)

### 3. Install dependencies and run it

From inside the `fabric-flo` folder:

```bash
npm install
npm run dev
```

Open the printed URL (e.g. `http://localhost:5173`) in your browser. If the Fabric Flo marketing
page loads at `/` and the app at `/app`, **the transfer worked.** 🎉

### 4. Recreate your secrets file (`.env`)

`.env` is **intentionally not** on GitHub (it holds secrets). Recreate it on Windows:

1. In the project, copy `.env.example` to a new file named `.env`.
2. Fill in the same values you use on the Mac:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_FABRIC_FLO_BACKEND=normalized`
   - `VITE_PUBLIC_APP_URL`, `VITE_SUPPORT_EMAIL`, `VITE_PRIVACY_EMAIL`

> Find these in your Supabase dashboard (**Project Settings ▸ API**) and your Netlify settings.
> Never commit `.env` — `.gitignore` already blocks it.

### 5. Save future changes back to GitHub

After editing on Windows, send your work back so every machine stays in sync:

```bash
git add -A
git commit -m "Describe what you changed"
git push
```

(Or in GitHub Desktop: write a summary → **Commit to main** → **Push origin**.)

---

## Method B — Manual copy (USB / external drive) — fallback only

Use this **only** if you can't use GitHub. It's slower and easier to get wrong.

1. On the Mac, **quit** anything using the project.
2. Copy the **entire** `FABRIC FLO APP` folder to a USB drive — **but delete these first** (they're huge
   and rebuild automatically): `node_modules`, `dist`, `ios/App/Pods`.
3. On Windows, copy the folder off the USB to e.g. `C:\Users\You\Documents\fabric-flo`.
4. Open a terminal there and run `npm install`, then `npm run dev`.
5. Recreate `.env` (step 4 above).
6. **Reconnect it to GitHub** so you still get backups:
   ```bash
   git remote -v        # if this prints origin, you're already connected
   git push
   ```
   If `origin` is missing:
   ```bash
   git remote add origin https://github.com/KeatingMichael/fabric-flo.git
   git push -u origin main
   ```

> You do **not** need USB for your friend's Mac either — they can `git clone` the same GitHub repo.

---

## After it's running on Windows — what's different?

| Task | Windows 11 | Notes |
|------|-----------|-------|
| Run the web app / develop | ✅ `npm run dev` | Identical to Mac |
| Build the web/PWA | ✅ `npm run build` | Identical |
| Deploy to Netlify | ✅ `npm run netlify:deploy` | Identical |
| **Build the Android app** | ✅ Android Studio | `npm run cap:sync` then open `android/` |
| **Build the iOS app** | ❌ not on Windows | Use **Codemagic** (cloud Mac) or a friend's Mac |
| Generate PDFs / icons | ✅ | Same npm scripts |

The `npm run build:native` script is **Mac-only** (it shells out to a bash script and Xcode).
On Windows, build Android directly:

```bash
npm run build
npx cap sync android
npm run cap:android      # opens Android Studio
```

Then in Android Studio: **Build ▸ Generate Signed App Bundle** to get the `.aab` for Google Play.

---

## Sanity checklist (tick these on Windows before you trust it)

- [ ] `node -v` prints `v20.x`
- [ ] `git clone` (or copy) completed without errors
- [ ] `npm install` finished
- [ ] `npm run dev` opens the app at `/` and `/app`
- [ ] `.env` recreated with your Supabase + URL values
- [ ] `git push` succeeds (a tiny test edit shows up on GitHub)

When all six are checked, your Mac is free to hand off. Continue with
**`docs/FINISH_AND_SUBMIT_CHECKLIST.md`** to get into both app stores.

---

**Fabric Flo** — Film fabric & bag tracker for productions.
Repo: <https://github.com/KeatingMichael/fabric-flo>
