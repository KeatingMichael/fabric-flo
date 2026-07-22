# Fabric Flo — Windows Quick Start (Cursor + all commands)

**Print this PDF or keep it open while you set up Windows 11.**
Michael Keating · June 2026 · Plain English

**Repo:** `https://github.com/KeatingMichael/fabric-flo`  
**Live site:** `https://fabricflo-app.com`  
**You do NOT need a USB drive** — clone from GitHub.

---

## What PDFs already exist in `docs/`

| Open this file | When |
|----------------|------|
| **`Fabric_Flo_Windows_Quick_Start.pdf`** | **Start here** — this doc, all commands |
| `Fabric_Flo_Transfer_To_Windows.pdf` | Extra detail on clone + Android later |
| `Fabric_Flo_Complete_Roadmap.pdf` | Full Mac → Windows → both app stores path |
| `Fabric_Flo_Codemagic_Setup.pdf` | After Part 1 — TestFlight / iOS builds |
| `Fabric_Flo_Finish_And_Submit_Checklist.pdf` | Store submission tick-list |
| `WINDOWS_HANDOFF.md` | Paste block for a new Cursor chat (markdown) |

After you clone the repo, all of these live in the **`docs`** folder inside the project.

---

## Step 1 — Install tools (once)

Download and install (defaults are fine):

| Tool | Link |
|------|------|
| **Git for Windows** | https://git-scm.com/download/win |
| **Node.js 20 LTS** | https://nodejs.org/en/download |
| **Cursor** | https://cursor.com *(you already have this)* |
| **GitHub Desktop** *(optional, easier clone)* | https://desktop.github.com |

Close and reopen Cursor after installing Git and Node.

**Verify in Cursor terminal** (Terminal → New Terminal):

```powershell
git --version
node -v
```

`node -v` should print **`v20.x`**.

---

## Step 2 — Clone the project in Cursor

You do **not** open the project from GitHub in Chrome. You **clone** it to your PC, then open that folder in Cursor.

### Option A — Cursor (recommended)

1. Open **Cursor**
2. Click **Clone repo** on the welcome screen  
   *(or **File → Clone Repository**)*
3. Sign in to **GitHub** if asked
4. Search **`fabric-flo`** or paste:
   ```
   https://github.com/KeatingMichael/fabric-flo.git
   ```
5. Choose folder: e.g. `C:\Users\YourName\Documents\fabric-flo`
6. Click **Clone** → **Open**

### Option B — GitHub in Chrome + terminal

1. Go to **https://github.com/KeatingMichael/fabric-flo**
2. Green **Code** → copy HTTPS URL
3. In Cursor terminal:

```powershell
cd $HOME\Documents
git clone https://github.com/KeatingMichael/fabric-flo.git
cd fabric-flo
```

4. **File → Open Folder** → select `Documents\fabric-flo`

### Option C — GitHub Desktop

1. **File → Clone repository** → pick **fabric-flo**
2. In Cursor: **File → Open Folder** → that folder

---

## Step 3 — Install dependencies

In Cursor terminal (project folder open):

```powershell
npm install
```

Wait until it finishes (first time can take several minutes).

---

## Step 4 — Create `.env` (secrets from Apple Notes)

```powershell
Copy-Item .env.example .env
```

Open **`.env`** in Cursor. Paste from your password manager / Notes:

```env
VITE_SUPABASE_URL=https://zfrekjlqpkipuoliptpd.supabase.co
VITE_SUPABASE_ANON_KEY=PASTE_YOUR_FULL_eyJ_KEY_HERE
VITE_FABRIC_FLO_BACKEND=normalized
VITE_PUBLIC_APP_URL=https://fabricflo-app.com
VITE_SUPPORT_EMAIL=support@fabricflo.app
VITE_PRIVACY_EMAIL=privacy@fabricflo.app
```

Use the **Legacy anon public** key (`eyJ...`), **not** `sb_publishable_`.  
**Never commit `.env`** — it stays on your PC only.

---

## Step 5 — Run the app

```powershell
npm run dev
```

Open Chrome:

| URL | What you should see |
|-----|---------------------|
| http://localhost:5173/ | Marketing / landing page |
| http://localhost:5173/app | Sign in → **Virgin River** production |

Stop the server when done: **Ctrl+C** in the terminal.

---

## Step 6 — Paste into a new Cursor chat

Open **`docs/WINDOWS_HANDOFF.md`**, copy everything **below the first `---` line**, paste into a **new Cursor chat**, and send. That tells the AI where you left off on the Mac.

---

## Sanity checklist

- [ ] `git --version` and `node -v` (v20.x) work
- [ ] Project cloned — you see `src`, `docs`, `package.json`
- [ ] `npm install` finished without errors
- [ ] `.env` filled from Notes (not empty URL/key)
- [ ] `npm run dev` — `/` and `/app` load, sign-in works
- [ ] Opened `docs/WINDOWS_HANDOFF.md` in new Cursor chat

**Part 1 complete** when all boxes are checked.

---

## What comes next (don't skip order)

1. **Part 2** — Verify live backend + Netlify (likely already done on Mac)
2. **Part 3** — Apple Developer ($99/yr) + Google Play ($25) — start early
3. **Part 6** — **Codemagic → TestFlight** — priority for label scanning on iPhone
4. **Part 5** — Android Studio → Google Play internal testing

Full path: **`Fabric_Flo_Complete_Roadmap.pdf`**

---

## Common problems

| Problem | Fix |
|---------|-----|
| `git` not recognized | Install Git for Windows, restart Cursor |
| `node` not recognized | Install Node 20 LTS, restart Cursor |
| Clone asks for password | Use GitHub sign-in in Cursor, not your GitHub password |
| Sign-in fails locally | Check `.env` URL and anon key — no extra spaces |
| Slow label scan in browser | Normal in Safari/Chrome — test scans in **TestFlight** app later |

---

## All commands in one block (copy/paste)

```powershell
git --version
node -v
cd $HOME\Documents
git clone https://github.com/KeatingMichael/fabric-flo.git
cd fabric-flo
npm install
Copy-Item .env.example .env
notepad .env
npm run dev
```

Edit `.env` in Notepad (or Cursor) before `npm run dev`.  
If you cloned via Cursor’s **Clone repo**, skip the `git clone` lines and run `npm install` from inside the project folder.

---

**Fabric Flo** — Film fabric & bag tracker for productions.
