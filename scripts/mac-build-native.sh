#!/usr/bin/env bash
# Build Fabric Flo for the App Store / Google Play from a Mac.
# Run: bash scripts/mac-build-native.sh
#
# This prepares the native projects. The final signing/upload steps happen in
# Xcode (iOS) and Android Studio (Android) because they require your developer accounts.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "=============================================="
echo "  Fabric Flo — native build prep"
echo "=============================================="

# --- Prerequisite checks ---------------------------------------------------
have() { command -v "$1" >/dev/null 2>&1; }

echo ""
echo "Checking tools..."
have node && echo "  node $(node -v)" || { echo "  ✖ Node not found — install Node 18+"; exit 1; }
have npm  && echo "  npm  $(npm -v)"  || { echo "  ✖ npm not found"; exit 1; }

XCODE_OK=1
if ! xcodebuild -version >/dev/null 2>&1; then
  echo "  ⚠ Full Xcode not detected (iOS build will be skipped)."
  echo "    Install Xcode from the App Store, then run: sudo xcode-select -s /Applications/Xcode.app"
  XCODE_OK=0
fi
PODS_OK=1
if ! have pod; then
  echo "  ⚠ CocoaPods not found (iOS pods will be skipped). Install: sudo gem install cocoapods"
  PODS_OK=0
fi

# --- Web build -------------------------------------------------------------
echo ""
echo "1/4 Installing dependencies (npm ci)..."
npm ci

echo ""
echo "2/4 Building web app (npm run build)..."
npm run build

echo ""
echo "3/4 Regenerating native icons & splashes from assets/logo.png..."
npx --yes @capacitor/assets generate \
  --iconBackgroundColor '#FFFFFF' --iconBackgroundColorDark '#FFFFFF' \
  --splashBackgroundColor '#FFFFFF' --splashBackgroundColorDark '#0f172a' || \
  echo "  (asset generation skipped/failed — continuing)"

echo ""
echo "4/4 Syncing web build into native projects (npx cap sync)..."
if [ "$XCODE_OK" = "1" ] && [ "$PODS_OK" = "1" ]; then
  npx cap sync
else
  echo "  Syncing Android only (iOS needs Xcode + CocoaPods)..."
  npx cap sync android
fi

echo ""
echo "=============================================="
echo "  Next steps (require your developer accounts)"
echo "=============================================="
echo ""
echo "ANDROID (Google Play):"
echo "  npm run cap:android      # opens Android Studio"
echo "  Build > Generate Signed Bundle/APK > Android App Bundle (.aab)"
echo "  Create + BACK UP a keystore; upload the .aab to Play Console."
echo ""
echo "iOS (App Store):"
if [ "$XCODE_OK" = "1" ]; then
  echo "  npm run cap:ios          # opens Xcode"
  echo "  Set your Team under Signing & Capabilities, then Product > Archive > Distribute."
else
  echo "  Install Xcode first, then re-run this script and use: npm run cap:ios"
fi
echo ""
echo "Listing copy: docs/STORE_LISTING.md"
echo "Reviewer notes + demo account: docs/APP_REVIEW_NOTES.md"
echo "Full checklist: docs/APP_STORE_RELEASE_CHECKLIST.md"
