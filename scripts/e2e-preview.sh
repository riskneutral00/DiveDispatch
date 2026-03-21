#!/usr/bin/env bash
set -euo pipefail

# Isolated E2E: creates an ephemeral Convex preview deployment,
# seeds it, runs Playwright, then lets it auto-expire.
#
# Requires CONVEX_PREVIEW_DEPLOY_KEY in .env.local
# Generate at: dashboard.convex.dev → Settings → Deploy Keys → Preview

if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | grep CONVEX_PREVIEW_DEPLOY_KEY | xargs)
fi

if [ -z "${CONVEX_PREVIEW_DEPLOY_KEY:-}" ]; then
  echo "ERROR: CONVEX_PREVIEW_DEPLOY_KEY not set."
  echo "Generate at: dashboard.convex.dev → Settings → Deploy Keys → Preview"
  exit 1
fi

PREVIEW_NAME="e2e-$(date +%s)"
echo "==> Creating preview deployment: $PREVIEW_NAME"

# Deploy schema + functions to a fresh isolated backend.
# --preview-run seeds the DB after deploy.
# --cmd launches the inner script with NEXT_PUBLIC_CONVEX_URL injected.
CONVEX_DEPLOY_KEY="$CONVEX_PREVIEW_DEPLOY_KEY" \
  npx convex deploy \
  --preview-create "$PREVIEW_NAME" \
  --preview-run "seed:seedAll" \
  --cmd "bash scripts/e2e-run-inner.sh" \
  --cmd-url-env-var-name "NEXT_PUBLIC_CONVEX_URL" \
  -y

# Exit code propagates from --cmd
