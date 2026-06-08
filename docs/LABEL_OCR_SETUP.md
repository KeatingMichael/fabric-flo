# Handwritten label OCR (free cloud options)

Fabric Flo reads rental-house stickers (job number, fabric type, size). **Handwritten label** is
the default on the Scan screen.

## Free options (pick one)

| Option | Cost | Credit card? | Monthly limit | Best for |
|--------|------|--------------|---------------|----------|
| **OCR.space** (recommended to start) | **$0** | **No** | 25,000 scans (~500/day) | Side project, one production, no billing setup |
| **Google Cloud Vision** | **$0** then ~$1.50/1k | Yes (billing account) | **1,000 free**, then paid | Highest accuracy; fine if you stay under 1k scans/mo |
| **On-device only** (no setup) | **$0** | No | Unlimited | Offline; weaker on messy handwriting — tap to fix lines |
| **Native iOS/Android app** (future) | **$0** | No | Unlimited | Apple Vision / ML Kit on phone — best free offline when the App Store build ships |

The live web app tries **cloud OCR first** (when you’re signed in and a key is configured), then
falls back to on-device Tesseract automatically.

---

## Easiest free setup: OCR.space (~5 minutes)

No Google account. No credit card.

### 1. Get a free API key

1. Open [ocr.space/ocrapi](https://ocr.space/ocrapi).
2. Register for a **free API key** (25,000 requests/month).

### 2. Add the secret in Supabase

[Supabase Dashboard](https://supabase.com/dashboard) → your project → **Edge Functions** →
**Secrets**:

```text
OCR_SPACE_API_KEY=paste_your_key_here
```

### 3. Deploy the Edge Function

From the repo root (Supabase CLI linked to your project):

```bash
supabase functions deploy label-ocr
```

### 4. Test

1. Sign in at `/app` on **fabricflo-app.com**.
2. Scan → **Handwritten label** → photograph a test sticker.
3. All three lines should be much closer than on-device OCR alone.

---

## Alternative: Google Cloud Vision (also free at low volume)

Google gives **1,000 document-text scans per month free** (resets monthly). You need a billing
account with a card on file, but you are **not charged** while you stay under 1,000 scans/month.

1. [Google Cloud Console](https://console.cloud.google.com/) → enable **Cloud Vision API** → create
   an API key (restrict to Vision only).
2. Supabase secret: `GOOGLE_VISION_API_KEY=your_key`
3. Deploy: `supabase functions deploy label-ocr`

If **both** keys are set, Google is tried first; OCR.space is the fallback.

---

## How it works in the app

| When | Engine |
|------|--------|
| Signed in + online + cloud key configured | OCR.space or Google Vision |
| Offline or no cloud key | On-device Tesseract |

Crew can always edit the three fields before **Continue to Fabrics**.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Still poor reads while signed in | Deploy `label-ocr` and set `OCR_SPACE_API_KEY` or `GOOGLE_VISION_API_KEY` |
| Works on web but not PWA | Clear Safari site data and reload |
| “No text detected” | Brighter light, white label fills the frame, tap SCAN again |
| Line 1 wrong, 2–3 right | Tap line 1 and type the sticker number — normal on very messy writing |

See also [`docs/BACKEND_SETUP.md`](BACKEND_SETUP.md).
