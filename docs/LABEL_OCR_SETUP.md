# Handwritten label OCR (cloud)

Fabric Flo reads rental-house stickers with three lines (job number, fabric type, size). Most
productions do not have dynamic QR codes on gear yet — **handwritten label scan is the default**
on the Scan screen.

## How it works

| When | Engine |
|------|--------|
| Signed in + online + Vision API configured | **Google Cloud Vision** (best handwriting accuracy) |
| Offline or Vision not set up | On-device Tesseract (fallback; may need a quick tap to fix line 1) |

The app tries cloud OCR first, then falls back automatically. Crew still edit the three fields
before continuing — that is expected on set.

## One-time setup (operator, ~10 minutes)

You need a Google Cloud project with the **Cloud Vision API** enabled and a Supabase Edge Function
secret. Typical cost is about **$1.50 per 1,000 label scans** (Vision document text detection).

### 1. Google Cloud Vision

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create or pick a project.
2. **APIs & Services → Library** → enable **Cloud Vision API**.
3. **APIs & Services → Credentials** → **Create credentials → API key**.
4. Restrict the key to **Cloud Vision API** only (recommended).
5. Copy the API key.

### 2. Supabase secret

In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Edge Functions**
→ **Secrets**:

```text
GOOGLE_VISION_API_KEY=paste_your_key_here
```

### 3. Deploy the Edge Function

From the repo root (with [Supabase CLI](https://supabase.com/docs/guides/cli) linked to your
project):

```bash
supabase functions deploy label-ocr
```

The function requires a signed-in user (same as your other cloud features). No app rebuild is
needed after deploy — the live site picks it up on the next scan.

### 4. Verify

1. Sign in at `/app` on **fabricflo-app.com**.
2. Scan → **Handwritten label** → photograph a test sticker.
3. Lines 2 and 3 should usually be correct; line 1 (job number) should be much closer than
   on-device OCR alone.

If cloud OCR is not configured, scans still work using on-device OCR.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Still poor reads while signed in | Confirm `GOOGLE_VISION_API_KEY` secret and `label-ocr` function deployed |
| Works on web but not PWA | Clear Safari site data and reload (old service worker cache) |
| “No text detected” | Brighter light, fill frame with white label only, tap SCAN again |
| Line 1 wrong, 2–3 right | Normal for very messy handwriting — tap line 1 and type the sticker number |

See also [`docs/BACKEND_SETUP.md`](BACKEND_SETUP.md) for Supabase project setup.
