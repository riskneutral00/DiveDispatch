---
name: driver-debrief
description: "Write/append driver session summary to Vault."
allowed-tools: Read, Write, Bash, Glob
user-invocable: false
---

# driver-debrief

Called by `/driver` at batch cap or idle exit. Writes session stats to vault.

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
