#!/usr/bin/env bash
# Push Fabric Flo to KeatingMichael/fabric-flo on GitHub.
# Run: bash scripts/push-to-github.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "Checking GitHub login..."
if ! gh auth status &>/dev/null; then
  echo ""
  echo ">>> You are NOT logged in to GitHub yet."
  echo ">>> Run this command ALONE (nothing else on the same line):"
  echo ""
  echo "    gh auth login"
  echo ""
  echo "Then choose:"
  echo "  - GitHub.com"
  echo "  - HTTPS"
  echo "  - Login with a web browser"
  echo "  - Sign in as KeatingMichael"
  echo ""
  echo "When finished, run this script again:"
  echo "    bash scripts/push-to-github.sh"
  exit 1
fi

echo "Logged in as: $(gh api user -q .login)"

if gh repo view KeatingMichael/fabric-flo &>/dev/null; then
  echo "Repo exists. Pushing..."
  git push -u origin main
else
  echo "Creating repo fabric-flo and pushing..."
  gh repo create fabric-flo --private --source=. --remote=origin --push
fi

echo ""
echo "Done! Open: https://github.com/KeatingMichael/fabric-flo"
