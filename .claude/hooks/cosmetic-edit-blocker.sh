#!/usr/bin/env bash
# PreToolUse hook: block Edit/Write hunks whose only change is cosmetic
# (comment relocation, comment rephrase, whitespace reflow, quote-style flip).
#
# The "Stay in scope" rule in .claude/rules/code-style-nav.md says every
# changed line must trace to a specific element of the user's ask. A hunk
# where stripped-before == stripped-after for every line means no semantic
# change happened, so the edit didn't trace to anything.
#
# Algorithm:
#   1. Take old_string / new_string from the tool input (or full file for Write).
#   2. Strip JSX comments {/* */}, single-line block comments /* */,
#      line comments // to EOL, and leading/trailing whitespace.
#   3. Drop now-empty lines.
#   4. If the resulting line arrays are byte-identical -> block.
#   5. Otherwise -> allow.
#
# Known limitations (accepted):
#   - String literals containing // or /* /* are mangled by the naive stripper.
#     If a change is purely inside such a string, the hook may falsely block.
#     Recovery: rephrase the edit so the substantive change is visible to the
#     hook, or split into a smaller scope.
#   - Multi-line block comments are not fully tracked. Single-line is enough
#     for DD's no-comments-by-default codebase.
#   - MultiEdit is not analyzed (per-edit array iteration would slow this hook).

INPUT=$(cat)
TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || printf '')
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || printf '')

[ -z "$FILE_PATH" ] && exit 0

# Scope: only check source under convex/, src/, tests/, scripts/.
# Skip generated files. Patterns match both relative and absolute paths.
case "$FILE_PATH" in
  */convex/_generated/*|convex/_generated/*) exit 0 ;;
  *.generated.ts|*.generated.tsx|*.generated.js|*.generated.jsx) exit 0 ;;
  */convex/*|convex/*|*/src/*|src/*|*/tests/*|tests/*|*/scripts/*|scripts/*) ;;
  *) exit 0 ;;
esac

case "$TOOL_NAME" in
  Edit)
    OLD_CONTENT=$(printf '%s' "$INPUT" | jq -r '.tool_input.old_string // ""' 2>/dev/null || printf '')
    NEW_CONTENT=$(printf '%s' "$INPUT" | jq -r '.tool_input.new_string // ""' 2>/dev/null || printf '')
    ;;
  Write)
    NEW_CONTENT=$(printf '%s' "$INPUT" | jq -r '.tool_input.content // ""' 2>/dev/null || printf '')
    if [ -f "$FILE_PATH" ]; then
      OLD_CONTENT=$(cat "$FILE_PATH")
    else
      exit 0
    fi
    ;;
  *) exit 0 ;;
esac

# Empty old or new -> insertion or deletion, both substantive. Allow.
[ -z "$OLD_CONTENT" ] && exit 0
[ -z "$NEW_CONTENT" ] && exit 0

strip_cosmetic() {
  printf '%s\n' "$1" | awk '
    {
      gsub(/\{\/\*[^*]*\*\/\}/, "")
      gsub(/\/\*[^*]*\*\//, "")
      sub(/\/\/.*$/, "")
      gsub(/^[[:space:]]+|[[:space:]]+$/, "")
      if (length($0) > 0) print $0
    }
  '
}

# Count occurrences of each functional marker. If old vs new differ in any
# count, the marker set changed (added or removed) — that's a substantive
# suppression change, not a cosmetic relocation. Allow.
marker_signature() {
  local content="$1"
  printf '%s' "$content" | grep -oE 'batch-exempt|fsm-ok|snapshot:|bounded:|spacing-ok:|query-budget-ok:|design-ok|comments-ok' | sort | uniq -c | sort
}

OLD_MARKERS=$(marker_signature "$OLD_CONTENT")
NEW_MARKERS=$(marker_signature "$NEW_CONTENT")
if [ "$OLD_MARKERS" != "$NEW_MARKERS" ]; then
  exit 0
fi

OLD_STRIPPED=$(strip_cosmetic "$OLD_CONTENT")
NEW_STRIPPED=$(strip_cosmetic "$NEW_CONTENT")

if [ "$OLD_STRIPPED" = "$NEW_STRIPPED" ]; then
  cat <<'MSG' >&2
[Hook] cosmetic-edit-blocker:

This edit's before and after are semantically identical after stripping
comments and whitespace. The diff doesn't trace to a user-request element —
it's a cosmetic-only change.

Common patterns this catches:
  - Moving // batch-exempt / // fsm-ok / etc. between leading-line and
    trailing-same-line (canonical placements live in code-style-nav.md)
  - Rephrasing a comment without changing surrounding code
  - Re-indenting or re-spacing without changing logic
  - Flipping quote style without behavioral effect

Per .claude/rules/code-style-nav.md "Stay in scope":
  Every changed line must trace to a specific element of the user's ask.

What to do:
  - If you noticed something legitimate but out of scope, log it to
    .observations at repo root and surface at end-of-turn instead.
  - If a substantive change DOES exist in this hunk and the hook is wrong,
    bundle the substantive change into the same Edit so the hook can see it.
MSG
  exit 2
fi

exit 0
