# Handwritten label OCR (cloud)

Fabric Flo reads rental-house stickers (job number, fabric type, size) with the **Scan** camera.
Cloud OCR fills the three fields; crew tap to fix any line before **Add to Log**.

## Recommended: Google Cloud Vision (~2 seconds, best accuracy)

Google gives **1,000 document-text scans per month free**. After that it is about **$1.50 per
1,000 scans**. You need a billing account (card on file) but you are **not charged** while you stay
under 1,000 scans/month.

### What you do (one-time, ~10 minutes)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → project **FABRIC FLO**.
2. **APIs & Services → Library** → enable **Cloud Vision API**.
3. **Also enable Generative Language API** (powers Gemini Flash fallback on messy handwriting).
4. **APIs & Services → Billing** → link a billing account (required; first 1,000 Vision scans/month free).
5. **Credentials → Create credentials → API key** → restrict to **Cloud Vision API** + **Generative Language API**.
6. Copy the key.

### Add the key to Supabase

Project **`zfrekjlqpkipuoliptpd`** (Fabric Flo) — from the repo root with Supabase CLI logged in:

```bash
supabase secrets set GOOGLE_VISION_API_KEY=paste_your_key_here --project-ref zfrekjlqpkipuoliptpd
supabase functions deploy label-ocr --project-ref zfrekjlqpkipuoliptpd
```

Or in [Supabase Dashboard](https://supabase.com/dashboard/project/zfrekjlqpkipuoliptpd/settings/functions)
→ **Edge Functions → Secrets** → add `GOOGLE_VISION_API_KEY`, then deploy `label-ocr`.

### Test

1. Pull to refresh **fabricflo-app.com** on your phone (or clear Safari site data once).
2. Sign in → open a production → **Scan → Rental label**.
3. Fill the white sticker in frame → **Scan**. Fields should fill in about **2–5 seconds**.

Keep your existing `OCR_SPACE_API_KEY` if you have one — it becomes automatic fallback if Vision
ever fails.

---

## Free fallback: OCR.space (no credit card)

| | OCR.space | Google Vision |
|--|-----------|---------------|
| Cost | $0 | $0 then ~$1.50/1k |
| Card required | No | Yes (billing account) |
| Speed | ~3–5s | ~1–3s |
| Handwriting | OK | Better |

1. Register at [ocr.space/ocrapi](https://ocr.space/ocrapi) (25,000 requests/month free).
2. `supabase secrets set OCR_SPACE_API_KEY=your_key --project-ref zfrekjlqpkipuoliptpd`
3. `supabase functions deploy label-ocr --project-ref zfrekjlqpkipuoliptpd`

---

## How it works in the app

| When | Engine |
|------|--------|
| Signed in + online + `GOOGLE_VISION_API_KEY` set | Google Vision (primary) |
| Vision miss / error + `OCR_SPACE_API_KEY` set | OCR.space (fallback) |
| Offline or not signed in | Tap fields manually |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| “Couldn’t read” / empty fields | Confirm secret is set and `label-ocr` redeployed after adding the key |
| Vision billing error in Supabase logs | Enable billing + Cloud Vision API in Google Cloud |
| Slow reads | Vision should be ~2s; check phone signal; pull to refresh PWA |
| Wrong fabric line (e.g. SOLO) | Tap **Fabric** and fix — or pick from suggestions |
| Sync dialog mid-scan | Pull latest app; should only appear once per sign-in |

See also [`docs/BACKEND_SETUP.md`](BACKEND_SETUP.md).
