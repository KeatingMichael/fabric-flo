# Mobile release (App Store & Google Play)

Fabric Flo ships as a **Vite web app** wrapped with **Capacitor** for iOS and Android.

## Prerequisites

- Apple Developer Program ($99/year) and a Mac with Xcode
- Google Play Console ($25 one-time)
- Production hosting over **HTTPS** (for Privacy Policy URL and password reset)
- Supabase project with migrations `001`–`008` and `VITE_FABRIC_FLO_BACKEND=normalized`

For the full store checklist (privacy labels, account deletion, TestFlight), see **[STORE_RELEASE.md](./STORE_RELEASE.md)**.

**Printable checklist PDF:** run `npm run store:pdf` → `docs/Fabric_Flo_App_Store_Release_Checklist.pdf`

## One-time setup

```bash
npm install
npm run build
npx cap add ios
npx cap add android
npx cap sync
```

Open native projects:

```bash
npx cap open ios
npx cap open android
```

## Environment (production)

In `.env` (not committed):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_FABRIC_FLO_BACKEND=normalized
VITE_PUBLIC_APP_URL=https://your-production-domain.com
VITE_SUPPORT_EMAIL=support@yourdomain.com
VITE_PRIVACY_EMAIL=privacy@yourdomain.com
```

`VITE_PUBLIC_APP_URL` must serve the built app at `/privacy` and `/terms` (same routes as the web build).

## Store listing checklist

- [ ] Privacy Policy URL → `https://your-domain.com/privacy`
- [ ] Support URL or email → `VITE_SUPPORT_EMAIL`
- [ ] App icons 1024×1024 (iOS), adaptive icon (Android)
- [ ] Screenshots (phone; tablet if supporting iPad)
- [ ] Camera usage description (Info.plist): *Scan QR codes on fabric cases*
- [ ] App Privacy questionnaire (Apple): email, user content (inventory/scans), no tracking
- [ ] Data safety form (Google): same disclosures
- [ ] Account deletion: in-app **Request account deletion** + process requests within stated SLA

## Build release binaries

After `npm run build`:

```bash
npx cap sync
# iOS: Archive in Xcode → Distribute to App Store Connect
# Android: Build → Generate signed App Bundle in Android Studio
```

## Test before submit

1. TestFlight (iOS) and Play internal testing
2. Offline scan → reconnect → cloud sync
3. Sign up with Terms/Privacy checkbox
4. Forgot password email
5. Delete data on device + request account deletion email

## Legal docs in repo

In-app routes: `/privacy`, `/terms`. Host the same build at your public origin for store URLs.
