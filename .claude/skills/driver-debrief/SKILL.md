---
name: driver-debrief
description: "Write/append driver session summary to Vault."
allowed-tools: Read, Write, Bash, Glob
user-invocable: false
---

# driver-debrief

Called by `/driver` at batch cap or idle exit. Writes session stats to vault.

## Promote Run Knowledge

Read `.car/run-knowledge/learnings.md`. If it contains entries, extract the top 3-5 most generalizable learnings (ones that apply beyond this specific batch) and append them to `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Architecture/Lessons.md`:

```markdown
## Car Run Learnings — {YYYY-MM-DD}
- {learning 1}
- {learning 2}
```

Skip learnings that are ticket-specific or already in Lessons.md.

## Write Handoff

Write `.car/handoff.json` for the next session's preflight to read:

```json
{
  "written_at": "{ISO timestamp}",
  "last_ticket": "DD-{id}",
  "last_ticket_outcome": "{completed|blocked}",
  "knowledge_highlights": ["{top 3 learnings from run-knowledge}"],
  "pattern_warnings": ["{recurring issues, e.g. 'test fixture gaps caused 2 NO-GOs'}"],
  "nogo_rate": {session_stats.nogo_count / session_stats.tickets_attempted},
  "git_head": "{short sha from git rev-parse --short HEAD}"
}
```

Read `session_stats` from `.car/manifest.json` for the nogo_rate calculation.

## Write Session Summary

Append to `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Sessions/{YYYY-MM-DD}-driver.md`. If file exists (multiple batches same day), append a `---` separator.

```markdown
# Driver Session: {YYYY-MM-DD HH:MM}

## Stats
- Tickets completed: {N} ({list of IDs})
- Tickets blocked: {N} ({list of IDs + reasons})
- Backseat fixes handled: {N} ({list of IDs})
- Tests: {final count} passing across {N} files
- Duration: {HH:MM}
- Batches: {N}

## Blocked Tickets — Diagnosis
{For each blocked ticket:}
- DD-{NNN}: {title} — {blocked_reason}
  - Root cause: {why — timeout, conflict, test failure}
  - Pattern: {recurring issue type?}

## Backseat Fix Patterns
{Categorize backseat fixes:}
- {category}: {count} — {what keeps triggering these?}

## Improvement Observations
- {What slowed this session down?}
- {Which ticket types completed cleanly vs struggled?}
- {Recurring merge conflict areas?}
```

## Board Sync

After writing the session summary, regenerate the vault TODO.md mirror so it stays current without manual `/board sync`:

1. Read all `.tickets/DD-*.md` YAML frontmatter
2. Regenerate `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md` from current ticket state
3. This is the same logic as `/board sync` — group by status, sort by priority

## Memory Update

Update the active thread memory so `/first` in the next session has current context:

1. Read `~/.claude/projects/-Users-matthewlee-Desktop-RiskNeutral-DiveDispatch/memory/project_thread_dd_present.md`
2. Update:
   - **Test Baseline** — new test count from final `npx vitest run`
   - **Recent Commits** — last 5 from `git log --oneline -5`
   - **What's next / NEXT:** — first ready ticket from `.tickets/` (by priority, then ID)
   - **Board:** — current ticket counts by status
3. Update `MEMORY.md` active thread line with new `NEXT:` tag matching the ticket
