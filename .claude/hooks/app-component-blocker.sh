#!/usr/bin/env bash
# PreToolUse hook: Block component creation in src/app/.
# Only Next.js route files and _lib/ wrappers are allowed.
# Reusable components must live in src/components/.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')

# Only check src/app/ paths
case "$FILE_PATH" in
  */src/app/*) ;;
  *) exit 0 ;;
esac

# Allow _lib/ directories (route-local connected wrappers)
case "$FILE_PATH" in
  */_lib/*) exit 0 ;;
esac

# Allow __tests__/ directories
case "$FILE_PATH" in
  */__tests__/*) exit 0 ;;
esac

# Allow API route handlers
case "$FILE_PATH" in
  */api/*) exit 0 ;;
esac

# Allow dynamic import test files
case "$FILE_PATH" in
  *.test.*|*.spec.*) exit 0 ;;
esac

BASENAME=$(basename "$FILE_PATH")

# Allow known Next.js route file basenames
case "$BASENAME" in
  page.tsx|layout.tsx|error.tsx|loading.tsx|not-found.tsx|route.ts|template.tsx) exit 0 ;;
  manifest.ts|robots.ts|sitemap.ts|sw.ts|favicon.ico) exit 0 ;;
  globals.css) exit 0 ;;
  # Known legacy files
  dashboard-shell.tsx) exit 0 ;;
  # Dynamic import test helpers
  *.dynamic-imports.test.ts) exit 0 ;;
esac

# Block everything else
case "$FILE_PATH" in
  *.tsx|*.ts)
    echo "{\"decision\":\"block\",\"reason\":\"Component file '${BASENAME}' cannot be created in src/app/. Reusable components belong in src/components/. Route-local wrappers go in a _lib/ subdirectory.\"}"
    ;;
esac

exit 0
