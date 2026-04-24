#!/usr/bin/env bash
# PostToolUse hook: field-width-required.
# Flags input-primitive callsites missing a field-* width token, escape clause,
# className passthrough, or spread props. Enforces .claude/rules/dry-first.md
# Field Width Scale (.field-xs/sm/md/lg/xl in globals-utilities.css) and the
# three-layer model in design-system/MASTER.md.
#
# Scoped to files that import FieldRow (heuristic: standalone Inputs in
# search bars / filters / cards do not need width tokens). Escape hatch:
# {/* design-ok */} or // design-ok on the opening-tag line.
#
# Components watched: Input, SimpleSelect, Select. LanguageField is a picker
# whose width is content-driven (its FieldShell applies w-full). All other
# semantic field primitives (NameField, PhoneField, EmailField, BirthdayField,
# DateField, CountryField, NumberPicker, Textarea) now resolve their own
# default field-* token via src/lib/utils/field-width.ts — the callsite does
# not need to pass one. An explicit className at a callsite is only for
# semantic overrides (e.g. CountryField→field-lg for nationality).

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.tsx) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  */src/components/ui/*) exit 0 ;;
  *.test.*|*.spec.*) exit 0 ;;
  *.stories.*) exit 0 ;;
  */_generated/*) exit 0 ;;
esac

# Only enforce when the file actually uses FieldRow. Standalone inputs in
# search bars, header chrome, or filter strips don't need a width token.
if ! grep -q '<FieldRow\b' "$FILE_PATH"; then
  exit 0
fi

REPORT=$(python3 - "$FILE_PATH" <<'PYEOF'
import re, sys

path = sys.argv[1]
with open(path) as f:
    src = f.read()

WATCHED = ("Input", "SimpleSelect", "Select")

line_starts = [0]
for i, ch in enumerate(src):
    if ch == "\n":
        line_starts.append(i + 1)

def line_of(pos):
    lo, hi = 0, len(line_starts) - 1
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if line_starts[mid] <= pos:
            lo = mid
        else:
            hi = mid - 1
    return lo + 1

def opening_block(start):
    depth = 0
    i = start
    while i < len(src):
        ch = src[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        elif ch == ">" and depth == 0:
            return src[start:i + 1]
        i += 1
    return src[start:]

# Compute the FieldRow scope: list of (open_end, close_start) byte ranges that
# are *inside* a <FieldRow ...>...</FieldRow> block. Self-closing FieldRow
# elements have no inside scope. Stack handles nested rows even though the
# canonical pattern doesn't nest.
fr_open = re.compile(r"<FieldRow\b")
fr_close = re.compile(r"</FieldRow\s*>")

events = []
for m in fr_open.finditer(src):
    block = opening_block(m.start())
    is_self_close = block.rstrip().endswith("/>")
    events.append((m.start(), "open", m.start() + len(block), is_self_close))
for m in fr_close.finditer(src):
    events.append((m.start(), "close", m.end(), False))
events.sort()

scopes = []
stack = []
for pos, kind, end, self_close in events:
    if kind == "open":
        if self_close:
            continue
        stack.append(end)
    else:
        if stack:
            scopes.append((stack.pop(), pos))

def inside_fieldrow(pos):
    return any(start <= pos <= end for start, end in scopes)

ok_markers = ("field-", " w-", '"w-', "'w-", "col-span", "flex-1", "{className}",
              "{props.className}", "{...", "design-ok", "comments-ok")

violations = []
for name in WATCHED:
    for m in re.finditer(r"<" + name + r"\b", src):
        if not inside_fieldrow(m.start()):
            continue
        block = opening_block(m.start())
        if any(marker in block for marker in ok_markers):
            continue
        violations.append((line_of(m.start()), name, block.split("\n", 1)[0].strip()))

if violations:
    lines = []
    for ln, name, head in violations[:6]:
        head = (head[:80] + "…") if len(head) > 80 else head
        lines.append(f"  L{ln}: <{name}> — {head}")
    extra = "" if len(violations) <= 6 else f"\n  …and {len(violations) - 6} more"
    print(
        "Input primitive inside <FieldRow> is missing a field-* width token "
        "(or className passthrough / spread / design-ok). "
        "Apply field-xs/sm/md/lg/xl per globals-utilities.css. "
        "See design-system/MASTER.md § Field Width Scale.\n"
        + "\n".join(lines)
        + extra
    )
    sys.exit(1)
PYEOF
)

if [ $? -ne 0 ]; then
  REASON=$(printf '%s' "$REPORT" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))")
  printf '{"decision":"block","reason":%s}\n' "$REASON"
fi

exit 0
