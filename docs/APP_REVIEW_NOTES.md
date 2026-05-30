# App Review notes (Apple) & testing access (Google)

Paste the relevant parts into App Store Connect "App Review Information" and Play Console testing
notes. Fill in the bracketed values before submitting.

---

## Demo account (create this first)

App Review needs a working login. Create a demo account in YOUR production Supabase project:

1. Deploy the app with live Supabase env vars (see [docs/BACKEND_SETUP.md](BACKEND_SETUP.md)).
2. Sign up a demo user, e.g. `review@[yourdomain].com` / `[strong-password]`.
3. Sign in once, create a production named "Demo Show", add one location and one fabric + bag row,
   and save one scan so reviewers see populated data.

Provide in App Store Connect:

- **Username:** `review@[yourdomain].com`
- **Password:** `[strong-password]`
- **Sign-in required:** Yes (for cloud features) — but note the app also works without an account.

---

## Apple — Review notes (paste)

```
Fabric Flo helps film/TV production crews track fabrics and their matching bags on set.

HOW TO TEST
1. Sign in with the demo account above (or tap through on-device without an account).
2. Open a production, tap "Start Scanning".
3. The camera opens on the Scan screen only. Point at any QR code, OR tap the manual/label
   option to enter a code by hand (no camera needed to evaluate core flow).
4. Pick a place (studio / filming location / transport truck). The move appears in the Log.
5. Open Inventory to see one row = one fabric + its matching bag.
6. Department heads can create an Invite Code (Crew invites) and download rental lists (CSV + PDF).

CAMERA USAGE
The camera is used only on the Scan screen to read QR codes and labels. No video is recorded,
stored, or uploaded. Scanning can also be done manually without the camera.

ACCOUNT & DATA DELETION
Users can delete their data on-device and delete their cloud account in-app under Cloud account.

No special hardware required. Works on iPhone; tablet layout supported.
```

**Contact info:** `[your name]`, `[support@yourdomain.com]`, `[phone]`.

---

## Google Play — Testing instructions (paste)

```
Sign in with: review@[yourdomain].com / [strong-password]
(Or use the app on-device without an account.)

1. Open the "Demo Show" production and tap Start Scanning.
2. The camera is used only on the Scan screen for QR/label reading. You can also enter a code
   manually without the camera.
3. Choose a location; the move appears in the shared Log.
4. Inventory shows one row per fabric + matching bag pair.
5. Crew invites use an Invite Code; rental lists export as CSV + PDF.

Account and data deletion are available in-app under Cloud account.
```

---

## Permissions rationale (both stores)

| Permission | Why | User-facing string |
|-----------|-----|--------------------|
| Camera | Scan dynamic QR codes and rental-house labels on the Scan screen | iOS `NSCameraUsageDescription` (set in `ios/App/App/Info.plist`); Android `CAMERA` (set in `AndroidManifest.xml`) |

No location, contacts, microphone, or tracking permissions are requested.

---

## Pre-submission sanity check

- [ ] Demo account works on the live deployed build.
- [ ] Privacy Policy URL loads: `https://[YOUR_DOMAIN]/privacy`.
- [ ] Terms URL loads: `https://[YOUR_DOMAIN]/terms`.
- [ ] Camera prompt shows the usage string above.
- [ ] Account deletion path verified (Cloud account → delete).
- [ ] `npm run verify:release` passes.
