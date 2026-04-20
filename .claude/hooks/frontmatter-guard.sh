#!/usr/bin/env bash
# PreToolUse hook — block new vault files lacking required
# frontmatter (type + tier). Enforces Schema/frontmatter-schema.md.
#
# Handles Write (checks .tool_input.content — the full new file contents)
# and Edit (checks .tool_input.new_string — the edited chunk; skips when
# the edit doesn't touch frontmatter, since existing frontmatter is not
# visible to the hook).
#
# Topology-scoped: only files under Vaults/DiveDispatch/{Schema,raw,wiki}/
# or at the vault root (log.md, index.md). Other vault folders
# (HappyPath, AutoResearch, Overstory, Product, Legal, Research,
# Summaries) are outside the managed schema.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0

LOG_FILE=".claude/logs/pretooluse-blocks.log"
mkdir -p .claude/logs 2>/dev/null

# Only .md files
case "$FILE_PATH" in
  *.md) ;;
  *) exit 0 ;;
esac

# Only in DiveDispatch vault's managed topology
case "$FILE_PATH" in
  */Vaults/DiveDispatch/Schema/*.md|*/Vaults/DiveDispatch/raw/*.md|*/Vaults/DiveDispatch/wiki/*.md|*/Vaults/DiveDispatch/log.md|*/Vaults/DiveDispatch/index.md)
    ;;
  *)
    exit 0 ;;
esac

# Select the payload to inspect based on tool:
# - Write: .tool_input.content (full new file)
# - Edit:  .tool_input.new_string (edited chunk); if it doesn't contain
#          frontmatter markers, trust that the existing file has valid
#          frontmatter and skip (validated by /vault lint separately).
case "$TOOL_NAME" in
  Write)
    CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // ""' 2>/dev/null || echo "")
    ;;
  Edit|MultiEdit)
    NEW_STRING=$(echo "$INPUT" | jq -r '.tool_input.new_string // ""' 2>/dev/null || echo "")
    # If the edit doesn't touch the frontmatter block (no `---` fence + `type:`),
    # skip — we can't validate existing frontmatter from an Edit payload.
    if ! echo "$NEW_STRING" | head -c 400 | grep -q '^---'; then
      exit 0
    fi
    CONTENT="$NEW_STRING"
    ;;
  *)
    exit 0 ;;
esac

# Content must start with "---\n...\ntype: ...\ntier: ...\n...\n---"
# Permissive check: look for "type:" and "tier:" anywhere in first 400 chars
HEAD=$(echo "$CONTENT" | head -c 400)

if ! echo "$HEAD" | grep -q '^type:'; then
  REASON="Vault files in Schema/raw/wiki/ require frontmatter with \`type:\` (see Vaults/DiveDispatch/Schema/frontmatter-schema.md). Infer type from folder: plan, ticket, entity, invariant, pattern, log, raw, spec, session, failure, lint."
  printf '%s\tfrontmatter-guard\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FILE_PATH" "$REASON" >> "$LOG_FILE" 2>/dev/null
  echo "{\"decision\":\"block\",\"reason\":\"$REASON\"}"
  exit 0
fi

if ! echo "$HEAD" | grep -q '^tier:'; then
  REASON="Vault files in Schema/raw/wiki/ require frontmatter with \`tier:\` (working | episodic | semantic | procedural — see Vaults/DiveDispatch/Schema/memory-tiers.md)."
  printf '%s\tfrontmatter-guard\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FILE_PATH" "$REASON" >> "$LOG_FILE" 2>/dev/null
  echo "{\"decision\":\"block\",\"reason\":\"$REASON\"}"
  exit 0
fi

exit 0
