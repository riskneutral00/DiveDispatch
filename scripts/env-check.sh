#!/usr/bin/env bash
# Validates that all required environment variables are present in .env.local
# Run: bash scripts/env-check.sh
# Called by: preflight.sh, CI, or manually

set -euo pipefail

ENV_FILE="${1:-.env.local}"
ERRORS=0

check_var() {
  local var="$1"
  local required="${2:-true}"
  local value
  value=$(grep "^${var}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2- | sed 's/ *#.*//')

  if [ -z "$value" ]; then
    if [ "$required" = "true" ]; then
      echo "  [MISSING] $var"
      ERRORS=$((ERRORS + 1))
    else
      echo "  [OPTIONAL] $var (not set)"
    fi
  else
    echo "  [OK] $var"
  fi
}

echo "── Environment check: $ENV_FILE ──"

if [ ! -f "$ENV_FILE" ]; then
  echo "  [FAIL] $ENV_FILE not found"
  echo ""
  echo "  If this is a fresh clone, copy .env.example → .env.local and fill in values."
  echo "  Do NOT symlink to a shared config — DD needs its own .env.local."
  exit 1
fi

if [ -L "$ENV_FILE" ]; then
  echo "  [WARN] $ENV_FILE is a symlink → $(readlink "$ENV_FILE")"
  echo "         DD needs its own .env.local with project-specific vars."
  echo "         Break the symlink: cp --remove-destination \$(readlink $ENV_FILE) $ENV_FILE"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "Convex:"
check_var "CONVEX_DEPLOYMENT"
check_var "NEXT_PUBLIC_CONVEX_URL"

echo ""
echo "Clerk:"
check_var "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
check_var "CLERK_SECRET_KEY"
check_var "CLERK_ISSUER_URL"

echo ""
echo "App:"
check_var "NEXT_PUBLIC_APP_URL"
check_var "NEXT_PUBLIC_CLERK_SIGN_IN_URL"
check_var "NEXT_PUBLIC_CLERK_SIGN_UP_URL"

echo ""
echo "Optional:"
check_var "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" false
check_var "RESEND_API_KEY" false
check_var "NEXT_PUBLIC_CONVEX_SITE_URL" false

echo ""
echo "Convex dashboard env vars (verify manually in Convex dashboard):"
echo "  [INFO] CLERK_WEBHOOK_SECRET — required for Clerk webhook user sync"
echo "  [INFO] MEDICAL_ENCRYPTION_KEY — required for portal medical data encryption"

echo ""
echo "Integrity:"
if [ -f ".clerk/.tmp/keyless.json" ]; then
  echo "  [WARN] .clerk/.tmp/keyless.json exists — Clerk auto-provisioned a keyless instance."
  echo "         This means NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY wasn't found on startup."
  echo "         Delete .clerk/.tmp/ and verify your .env.local has the correct Clerk keys."
  ERRORS=$((ERRORS + 1))
else
  echo "  [OK] No keyless Clerk instance"
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "✗ $ERRORS required variable(s) missing. See .env.example for reference."
  exit 1
else
  echo "✓ All required variables present."
fi
