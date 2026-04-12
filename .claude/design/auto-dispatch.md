# Auto-dispatch Design — Hook-Invoked Skills

**Status:** Spike complete (2026-04-12). Implementation gated by this doc.

## Context

Matt's workflow goal: only type `/vault`. Everything else — `/gate`, `/post-spec`, review skills — must fire from hooks or scheduled tasks. This doc answers the runtime-mechanics questions that gated implementation.

## Question 1 — Can a shell hook trigger a Claude skill?

**Yes, via `claude --print` (headless mode).**

```bash
claude -p --allow-dangerously-skip-permissions \
  --disallowedTools "WebFetch WebSearch" \
  "run /gate on the staged diff and print the verdict"
```

Key flags:
- `-p / --print` — non-interactive. Emits final output to stdout, exits when done.
- `--allow-dangerously-skip-permissions` — required for unattended runs (no permission prompts).
- `--disallowedTools` — lock down blast radius. `/gate` only needs Read/Bash/Grep/Glob/Skill.
- `--bare` is available for minimum-overhead sessions but skips hooks, which defeats the purpose.

Output is the skill's final text response. Exit code reflects success/failure.

## Question 2 — Does `/gate` work non-interactively?

`/gate` (Pre-commit quality gate) is designed as a one-shot skill. It classifies the diff, dispatches review skills in parallel, collects findings, writes `.patrol-ran` JSON, and prints GO/NO-GO. No user input required mid-run.

**Caveat:** `/gate` auto-fixes fixable findings (max 2 cycles). In headless mode it will attempt those fixes. If that's unwanted in a pre-commit context, pass an argument to disable auto-fix.

## Question 3 — Cron for `/post-spec` ticket polling?

**Use the `schedule` skill.** It creates remote agents that fire on cron schedules via the `CronCreate` tool.

Concretely: a scheduled trigger every N minutes runs `claude -p "check .tickets/ for ready work; if any ready-unclaimed tickets exist, run /post-spec"`. The cron agent takes claim, does the work, commits, releases.

Alternative if cloud-scheduled agents aren't desired: local launchd plist calling `claude -p` on a timer.

## Question 4 — Failure semantics

**Pre-commit `/gate` fails (CRITICAL findings):**
- Hook exits non-zero → git blocks the commit.
- Matt sees the verdict in terminal, addresses findings, re-stages, retries.
- Optional: hook writes `.gate-blocked.txt` with the finding summary so Matt can open the file in-editor.

**Scheduled `/post-spec` fails mid-ticket:**
- The ticket's `status: in_progress` + `assigned_to: cron-agent` remains.
- A sweeper task (runs every 30 min) releases any claim older than 1h where no commit happened.
- Errors logged to `.claude/logs/post-spec-cron.log` for Matt to audit.

## Recommended wiring

### Pre-commit (`/gate`)

`.claude/hooks/gate-on-commit.sh` already exists as a PreToolUse:Bash hook matching commit commands. Current behavior: warns only. Change to:

```bash
# Match git commits
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
[[ ! "$COMMAND" =~ ^git[[:space:]]+commit ]] && exit 0

# Fire headless /gate
if ! claude -p --allow-dangerously-skip-permissions "/gate" > .gate-output.txt 2>&1; then
  VERDICT=$(tail -20 .gate-output.txt)
  echo "{\"decision\":\"block\",\"reason\":\"/gate NO-GO. See .gate-output.txt. Last lines:\n$VERDICT\"}"
  exit 0
fi

exit 0
```

### Ticket-polling cron (`/post-spec`)

Use the `schedule` skill once to create:
- **Name:** `post-spec-cron`
- **Schedule:** Every 15 min, weekdays 09:00–21:00 Asia/Taipei
- **Prompt:** Check `.tickets/` for `status: ready` tickets with non-empty Spec/Acceptance and no `assigned_to`. If any exist, invoke `/post-spec`. Otherwise exit silently.
- **Timeout:** 45 min (most tickets finish in <30 min; L-size may need more — log if exceeded).

And a second schedule:
- **Name:** `post-spec-sweeper`
- **Schedule:** Every 30 min.
- **Prompt:** Release any `.tickets/DD-*.md` with `status: in_progress`, `assigned_to: cron-agent`, and `updated` older than 60 min. Log the release.

### `/vault` stays manual

Per `.claude/rules/workflow-skills.md`: "/vault is explicit only." No change.

## Open questions — not blocking implementation

- **Headless Clerk auth.** Scheduled `/post-spec` may need to spin up test users via seed, not Clerk. Confirm when first run hits auth.
- **`/gate` auto-fix in pre-commit.** Does Matt want auto-fix to happen before the commit gate prints GO, or should auto-fix require explicit invocation? Default to no-auto-fix in pre-commit context.
- **Cost.** A 15-min cron that does nothing most of the time still burns tokens discovering "no ready tickets." Add a fast-path: if no `.tickets/DD-*.md` has `status: ready` and `assigned_to` empty (checked via simple grep), exit without invoking `/post-spec`.

## Implementation tickets (follow-up)

- **#3b:** Refactor `/gate` Phase 2 as the only review-skills + `/escalate` caller. Each `/review-*` drops self-escalation.
- **#3c:** Wire `gate-on-commit.sh` → headless `/gate`. Create `post-spec-cron` + `post-spec-sweeper` via `schedule`. Add `.claude/logs/post-spec-cron.log` output path. Add fast-path grep check to avoid spurious Claude invocations.
