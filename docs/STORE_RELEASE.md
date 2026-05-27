# App Store & Google Play release guide

Fabric Flo ships as a **Vite web app** wrapped with **Capacitor** for iOS and Android. Legal pages live in-app at `/privacy` and `/terms`.

## Prerequisites

| Item | Notes |
|------|--------|
| Apple Developer Program | $99/year — [developer.apple.com](https://developer.apple.com) |
| Google Play Console | $25 one-time |
| Production Supabase | All migrations `001`–`008` applied; `VITE_FABRIC_FLO_BACKEND=normalized` |
| Public HTTPS host | e.g. `https://app.fabricflo.com` — used for password reset and **Privacy Policy URL** in store listings |
| Support emails | Set `VITE_SUPPORT_EMAIL` and `VITE_PRIVACY_EMAIL` in production `.env` |

## 1. Production environment

Copy `.env.example` to production build env:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_FABRIC_FLO_BACKEND=normalized
VITE_PUBLIC_APP_URL=https://app.fabricflo.com
VITE_SUPPORT_EMAIL=support@fabricflo.app
VITE_PRIVACY_EMAIL=privacy@fabricflo.app
```

Run SQL migrations in order in the Supabase SQL editor (or CI).

## 2. Build web assets

```bash
npm ci
npm run build
```

## 3. Native projects (first time)

Requires Node 18+, Xcode (Mac) for iOS, Android Studio for Android.

```bash
npm run cap:add    # once: creates ios/ and android/
npm run cap:sync   # after each web build
npm run cap:ios    # open Xcode
npm run cap:android
```

### iOS — `ios/App/App/Info.plist`

Add (if not present):

```xml
<key>NSCameraUsageDescription</key>
<string>Fabric Flo uses the camera to scan QR codes on fabric and bag labels.</string>
```

### Android — `android/app/src/main/AndroidManifest.xml`

Ensure:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

### App icons

- Export **1024×1024 PNG** (no alpha for App Store) from `src/assets/fabric-flo-logo-widget.jpg`.
- Use Xcode Asset Catalog and Android `mipmap` generators, or [capacitor-assets](https://github.com/ionic-team/capacitor-assets).

## 4. Store listing checklist

### Both stores

- **App name:** Fabric Flo
- **Subtitle / short description:** Track fabrics & bags on set with QR scans
- **Privacy Policy URL:** `https://YOUR_DOMAIN/privacy` (must match `VITE_PUBLIC_APP_URL`)
- **Support URL / email:** `VITE_SUPPORT_EMAIL`
- **Category:** Business or Productivity
- **Age rating:** 4+ / Everyone (no UGC, no ads in v1)

### Apple App Privacy (nutrition labels)

Declare roughly:

| Data | Purpose | Linked to user |
|------|---------|----------------|
| Email | Account | Yes |
| User content (inventory, scans) | App functionality | Yes |
| Product interaction (scans) | App functionality | Yes |
| **Camera** | QR scan only — not collected as photos | No |

No tracking / no advertising ID in v1.

### Google Play Data safety

- Data collected: email, app activity (inventory/scans)
- Encrypted in transit: Yes
- Users can request deletion: Yes (in-app + email)
- Camera: optional, on-device QR only

## 5. Full auth deletion (optional Edge Function)

```bash
supabase functions deploy delete-account
```

Set in production `.env`: `VITE_ACCOUNT_DELETE_EDGE=1` (omit or `0` to use RPC + email only).

## 6. Legal & account deletion (implemented)

- In-app **Privacy** and **Terms** with consent on sign-up **and** sign-in.
- **Delete my account & cloud data** (Cloud account) calls `fabric_flo_delete_my_account` (migration `008`).
- Removes sole-admin productions and memberships; clears local data; signs out.
- **Auth user row:** Supabase may retain `auth.users` until you run a service-role purge. For full automation, add a Supabase Edge Function with `service_role` calling `auth.admin.deleteUser(uid)` after the RPC — document SLA (e.g. 30 days) in Privacy Policy.

## 7. Test before submit

1. **TestFlight** (iOS) — internal testers on set with real scans.
2. **Play internal testing** — same.
3. Offline: airplane mode → scan → assign location → go online → confirm sync banner clears.
4. Two devices same production → conflict banner → Pull latest / Retry.
5. Account deletion on a test user.
6. Invite flow: head creates code → crew accepts → shared inventory.

## 8. Submission notes for reviewers

Provide demo account:

- Email / password for a test production with sample items and QR payloads.
- Note: camera permission is required on Scan tab only.

Explain: workplace inventory tool for film/TV; not directed at children.

## 9. Ongoing operations

**Legal checklist PDF:** `npm run legal:pdf` → share `docs/Fabric_Flo_Legal_Checklist.pdf` with your attorney (not legal advice).

- `npm audit` and dependency updates quarterly.
- Monitor Supabase logs and enable backups.
- Optional: Sentry for crash reporting (disclose in Privacy Policy if added).
