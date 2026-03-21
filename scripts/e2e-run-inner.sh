#!/usr/bin/env bash
set -euo pipefail

# Inner script called by e2e-preview.sh via `--cmd`.
# NEXT_PUBLIC_CONVEX_URL is injected by the Convex CLI.

echo "==> Preview URL: $NEXT_PUBLIC_CONVEX_URL"

echo "==> Seeding Clerk users..."
tsx scripts/seed-clerk.ts --force 2>/dev/null || true

echo "==> Starting dev server..."
npm run dev &
DEV_PID=$!

# Wait for Next.js to be ready (up to 30s)
for i in $(seq 1 30); do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Running Playwright tests..."
npx playwright test "$@"
EXIT_CODE=$?

kill $DEV_PID 2>/dev/null || true
exit $EXIT_CODE
