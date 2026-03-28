---
name: backseat-debrief
description: "Write/append backseat session summary to Vault."
allowed-tools: Read, Write, Bash, Glob
user-invocable: false
---

# backseat-debrief

Called by `/backseat` at batch cap or idle exit. Writes session stats to vault.

## Write Session Summary

Append to `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Sessions/{YYYY-MM-DD}-backseat.md`. If file exists, append a `---` separator.

```markdown
# Backseat Session: {YYYY-MM-DD HH:MM}

## Stats
- Merges reviewed: {N}
- Tickets created: {N} (CRITICAL: {n}, HIGH: {n})
- Findings logged: {N} (MEDIUM: {n}, LOW: {n})
- Duration: {HH:MM}

## Tickets Created
{For each ticket:}
- DD-{NNN}: {title} [{severity}] — from {original_ticket}
  - Review skill: {which found it}
  - Fixed by driver: {yes/no}

## Recurring Issue Patterns
{Group by category:}
- {pattern}: {count} occurrences
  - Why: {diagnosis}
  - Prevention: {suggestion}

## Review Skill Effectiveness
- {skill}: {N} findings ({severity breakdown})
```

## Write Sentinels

```bash
echo '{"ran":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","tests":"backseat","status":"complete"}' > .last-ran
VERDICT=$( [ "$CRITICAL_COUNT" -gt 0 ] && echo "NO-GO" || echo "GO" )
echo '{"ran":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","verdict":"'"$VERDICT"'","critical":'"$CRITICAL_COUNT"',"high":'"$HIGH_COUNT"'}' > .gate-ran
```
