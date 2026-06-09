# Handwritten label OCR (cloud)

Fabric Flo reads rental-house stickers (job number, fabric type, size) with the **Scan** camera.
Cloud OCR fills the three fields; crew tap to fix any line before **Add to Log**.

## Pipeline (Plans A–E)

| Step | What | When |
|------|------|------|
| **B — Auto-capture** | Sharp frame + white label in guide → auto snap | Rental label tab |
| **E — Native Vision** | Apple Vision on Capacitor iOS app | Native build only |
| **A — Gemini JSON** | Structured `{ job, fabric, size }` from full label | Signed in + `GEMINI_API_KEY` |
| **C — Three-band strips** | Gemini reads job / fabric / size strips separately | Same request |
| **D — Inventory match** | Correct weak OCR against this production’s inventory | After read |
| Fallback | Vision + OCR.space text → client parsing | Gemini miss |

## Required: Gemini API key (Plan A — best accuracy)

Google **Generative Language API** + **Gemini 2.0 Flash** reads marker handwriting far better than Vision alone.

### Setup (~10 minutes)

1. [Google Cloud Console](https://console.cloud.google.com/) → project **FABRIC FLO**
2. Enable **Generative Language API**
3. **Credentials → API key** (can share billing with Vision or use a second key)
4. Add to Supabase:

```bash
supabase secrets set GEMINI_API_KEY=paste_key_here --project-ref zfrekjlqpkipuoliptpd
supabase secrets set GOOGLE_VISION_API_KEY=paste_vision_key --project-ref zfrekjlqpkipuoliptpd
supabase functions deploy label-ocr --project-ref zfrekjlqpkipuoliptpd
```

Also keep `OCR_SPACE_API_KEY` as free fallback.

### Test

1. Hard refresh **fabricflo-app.com** (or rebuild native app)
2. **Scan → Rental label** — hold sticker in frame; it auto-captures when sharp
3. Fields should fill in **~2–4 seconds**

## Native app (Plan E)

The iOS Capacitor build includes **FabricLabelOcrPlugin** (Apple Vision). Rebuild:

```bash
npm run cap:sync:full
npm run cap:ios
```

Android: web/cloud path until ML Kit plugin is added.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Wrong job number | Set `GEMINI_API_KEY`; pull latest app |
| “Not in inventory” | Add piece to inventory or fix fields manually |
| Auto-capture never fires | Tap **Scan** manually; improve lighting |
| Slow reads | Check signal; Gemini should be ~2s |

See also [`docs/BACKEND_SETUP.md`](BACKEND_SETUP.md).
