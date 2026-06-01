# START HERE — Fabric Flo, the simple version

**For someone with zero coding experience who wants this as a side income.**
Read top to bottom. Do one step at a time. Don't skip ahead. You've got this.

---

## What's already done (you don't have to do these)

- ✅ The app is **built** and works (fabrics + bags, scanning, logs, invites).
- ✅ The app **icon** and name (**Fabric Flo**) are set for all phones.
- ✅ All your work is **safely saved online** at GitHub, so nothing can get lost.
- ✅ The instructions for the hard parts are written for you (the PDFs in this folder).

So you are **not** starting from scratch. You're finishing the last mile.

---

## The whole journey in plain English

Think of it like opening a food truck:

1. **Set up the kitchen** (a free online database + a public website). — *the app needs a home online*
2. **Get your permits** (Apple + Google developer accounts). — *required to sell/list apps*
3. **Cook the meal** (turn the project into an iPhone app and an Android app). — *a robot service does this*
4. **Serve it** (submit to the App Store and Google Play, wait for approval).

That's it. Four stages. Below is exactly what to do for each.

---

## Stage 1 — Give the app a home online  *(about 1 evening)*

You need two free accounts. Both have free tiers — no cost to start.

- [ ] **Make a Supabase account** at <https://supabase.com> (this is the app's database/login system).
- [ ] **Make a Netlify account** at <https://netlify.com> (this puts your website online).
- [ ] Connect Netlify to your GitHub and pick the **`fabric-flo`** project — it builds the website automatically.

👉 **Follow this PDF for the exact clicks:** `Fabric_Flo_Transfer_To_Windows.pdf` is for moving computers;
for the website + database, use **`docs/INVESTOR_NETLIFY.md`** and **`docs/BACKEND_SETUP.md`**.

> Not ready for this yet? You can **skip Stage 1 for now** and still show the app to people by running
> it on your own computer. Stage 1 is only required before you submit to the stores.

---

## Stage 2 — Get your store "permits"  *(15 minutes each + approval wait)*

These cost money and can take a day or two to approve, so do them early.

- [ ] **Apple Developer account** — **$99/year** — <https://developer.apple.com>
- [ ] **Google Play Developer account** — **$25 once** — <https://play.google.com/console>

You sign up as yourself (or your business). That's all for now.

---

## Stage 3 — Turn the project into real phone apps  *(a robot does this)*

You don't need a Mac and you don't need to code. A free service called **Codemagic** takes your
project from GitHub and builds the iPhone + Android apps in the cloud.

- [ ] Make a **Codemagic** account at <https://codemagic.io> → sign in with GitHub → pick `fabric-flo`.
- [ ] Fill in the **fill-in-the-blank sheet** so Codemagic has your keys:
      👉 **`Fabric_Flo_Codemagic_Setup.pdf`** (every blank tells you where to find the answer).
- [ ] Press **Run** on the `ios-release` and `android-release` builds.

> Prefer a human to do this one part? This is the step you could hand to a freelancer for ~$50–150
> on Fiverr/Upwork: *"Set up Codemagic to build my Capacitor app from my GitHub repo and submit to
> TestFlight + Google Play internal testing."* Give them the `Codemagic Setup` PDF and you're set.

---

## Stage 4 — Submit and go live  *(follow the checklist)*

- [ ] Open **`Fabric_Flo_Finish_And_Submit_Checklist.pdf`** and tick the boxes.
- [ ] Add your store text + screenshots (drafts are ready in `docs/STORE_LISTING.md`).
- [ ] Submit. Apple usually reviews in 1–3 days; Google a few hours to a couple of days.

🎉 Once approved, your app is downloadable by anyone — and you can start charging.

---

## If you only remember one thing

Read the PDFs **in this order**, one at a time, and stop when you're done for the day:

1. `Fabric_Flo_Transfer_To_Windows.pdf` *(only if you're switching to the Windows PC)*
2. `Fabric_Flo_Finish_And_Submit_Checklist.pdf` *(your master to-do)*
3. `Fabric_Flo_Codemagic_Setup.pdf` *(the keys to paste for cloud builds)*

You do **not** need to understand the code. You only need to follow the steps and paste the values
the sheets ask for.

---

## Making it a side income (the short version)

- **What you sell:** access to Fabric Flo for productions/rental houses (per-production or monthly).
- **Cheapest path live:** Supabase free tier + Netlify free tier + $25 Google + $99 Apple = **~$124 to launch**.
- **Where to get help cheaply:** a one-off freelancer for the Codemagic/submit step (~$50–150) if you'd
  rather not do Stage 3 yourself. Everything else is point-and-click.
- **Updates later:** when you change anything, it's `git push`, then press **Run** in Codemagic again.

---

**Questions while you go?** Open the matching PDF for that stage — they're written step-by-step for
a first-timer. You're closer than it feels.

**Fabric Flo** — Film fabric & bag tracker for productions.
Repo: <https://github.com/KeatingMichael/fabric-flo>
