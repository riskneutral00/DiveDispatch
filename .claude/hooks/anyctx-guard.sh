#!/usr/bin/env bash
# PostToolUse hook: Block AnyCtx, GenericCtx, and `as any` in convex/**/*.ts
# Per `.claude/rules/code-style-nav.md`. Use QueryCtx / MutationCtx / DbCtx instead.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0

# Only scan convex/**/*.ts (not tests, not generated)
case "$FILE_PATH" in
  */convex/*.ts|*/convex/**/*.ts) ;;
  *) exit 0 ;;
esac
case "$FILE_PATH" in
  */_generated/*|*.test.ts|*.test.tsx) exit 0 ;;
esac

[ ! -f "$FILE_PATH" ] && exit 0

# Detect forbidden patterns, allow `// anyctx-ok: <reason>` escape on the same line
VIOLATIONS=$(grep -nE '\b(AnyCtx|GenericCtx)\b|\bas\s+any\b' "$FILE_PATH" | grep -v 'anyctx-ok' || true)

if [ -n "$VIOLATIONS" ]; then
  cat <<MSG
[Hook] anyctx-guard blocked $FILE_PATH:

$VIOLATIONS

Rule: .claude/rules/code-style-nav.md — Never use AnyCtx, GenericCtx, or \`as any\` in convex/.
Fix: Use QueryCtx (reads), MutationCtx (writes), or DbCtx (shared helpers). Never introduce \`as any\` to silence Convex type errors — fix the underlying type.
Escape: append \`// anyctx-ok: <reason>\` on the offending line if truly unavoidable.
MSG
  exit 2
fi

exit 0
