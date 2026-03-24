"""PreToolUse hook: Commit message quality gate.
Reads JSON from stdin, checks commit message quality."""
import sys
import json
import re

try:
    data = json.load(sys.stdin)
except (json.JSONDecodeError, ValueError):
    sys.exit(0)
cmd = data.get("tool_input", {}).get("command", "")

# Only check git commit commands
if not re.search(r"\bgit\s+commit\b", cmd):
    sys.exit(0)

# Extract message from -m flag (double or single quoted)
m = re.search(r'-m\s+"(.*?)"', cmd)
if not m:
    m = re.search(r"-m\s+'(.*?)'", cmd)
if not m:
    # heredoc or --amend — skip
    sys.exit(0)

msg = m.group(1).strip()
if not msg:
    sys.exit(0)

# Check minimum length
if len(msg) < 10:
    print(json.dumps({
        "decision": "block",
        "reason": f"Commit message too short ({len(msg)} chars). "
                  "Min 10 chars with format: type: description. "
                  "Types: feat, fix, refactor, test, chore, docs"
    }))
    sys.exit(0)

# Check conventional commit prefix
prefixes = r"^(feat|fix|refactor|test|chore|docs|revert|perf|ci|build|style):"
if not re.match(prefixes, msg):
    print(json.dumps({
        "decision": "block",
        "reason": "Commit message missing conventional prefix. "
                  "Use: feat:, fix:, refactor:, test:, chore:, docs:, revert:, perf:"
    }))
    sys.exit(0)
