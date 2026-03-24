"""PreToolUse hook: Test co-location reminder.
Warns when mutation/lib files are committed without test files."""
import sys
import json
import re
import subprocess

try:
    data = json.load(sys.stdin)
except (json.JSONDecodeError, ValueError):
    sys.exit(0)
cmd = data.get("tool_input", {}).get("command", "")

# Only check git commit commands
if not re.search(r"\bgit\s+commit\b", cmd):
    sys.exit(0)

# Get staged files
try:
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        capture_output=True, text=True, timeout=5
    )
    staged = result.stdout.strip().splitlines()
except Exception:
    sys.exit(0)

if not staged:
    sys.exit(0)

# Check for mutation/lib logic files
logic_pattern = re.compile(
    r"(convex/.*[Mm]utation|convex/.*/mutations|src/lib/).*\.ts$"
)
logic_files = [f for f in staged if logic_pattern.search(f)]
if not logic_files:
    sys.exit(0)

# Check for test files
test_pattern = re.compile(r"(tests/|\.test\.|\.spec\.)")
has_tests = any(test_pattern.search(f) for f in staged)
if has_tests:
    sys.exit(0)

# Warn (non-blocking — just print to stderr/stdout, no decision JSON)
print("[Hook] TDD reminder: mutation/lib changes staged without test files.")
print("Logic files:")
for f in logic_files[:5]:
    print(f"  {f}")
print("If tests exist elsewhere or this is a non-logic change, proceed.")
