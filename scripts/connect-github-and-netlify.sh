#!/usr/bin/env bash
# Connect Fabric Flo to GitHub (KeatingMichael) and deploy to Netlify (electriccreations).
# Run from repo root: bash scripts/connect-github-and-netlify.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GITHUB_USER="KeatingMichael"
REPO_NAME="fabric-flo"
REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo "=== Fabric Flo → GitHub (${GITHUB_USER}) + Netlify ==="
echo ""

# --- GitHub ---
if git remote get-url origin &>/dev/null; then
  echo "Git remote 'origin' already set: $(git remote get-url origin)"
else
  git remote add origin "$REMOTE_URL"
  echo "Added origin → $REMOTE_URL"
fi

echo ""
echo "STEP 1 — Create the GitHub repo (one time)"
echo "  Open: https://github.com/new?name=${REPO_NAME}&description=Fabric+Flo+film+fabric+tracker"
echo "  Owner: ${GITHUB_USER}"
echo "  Do NOT add README, .gitignore, or license (this repo already has them)."
echo ""
read -r -p "Press Enter after you clicked 'Create repository' on GitHub…"

echo ""
echo "STEP 2 — Push code to GitHub"
git push -u origin main

echo ""
echo "STEP 3 — Netlify (electriccreations account)"
echo "  Open: https://app.netlify.com/start/deploy?repository=https://github.com/${GITHUB_USER}/${REPO_NAME}"
echo "  Or: Add new site → Import from GitHub → pick ${REPO_NAME}"
echo "  Build: npm run build   Publish: dist   (netlify.toml already set)"
echo ""
echo "STEP 4 — Netlify environment variables (Site configuration → Environment variables)"
echo "  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_FABRIC_FLO_BACKEND=normalized"
echo "  VITE_PUBLIC_APP_URL=https://YOUR-SITE.netlify.app"
echo "  VITE_SUPPORT_EMAIL, VITE_PRIVACY_EMAIL"
echo "  Then: Deploys → Trigger deploy → Clear cache and deploy"
echo ""
echo "Your live links will be:"
echo "  https://YOUR-SITE.netlify.app/"
echo "  https://YOUR-SITE.netlify.app/app"
echo ""
echo "Done pushing to GitHub. Complete Netlify in the browser."
