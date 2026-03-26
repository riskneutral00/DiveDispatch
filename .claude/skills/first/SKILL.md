---
name: first
description: >
  Session opener. Resumes context from memory, prunes completed TODOs, detects stale/conflicting items,
  runs test health snapshot, identifies next work item, then starts working immediately.
allowed-tools: Read, Bash, Grep, Glob, Write, Edit, Agent
user-invocable: true
---

When this skill is invoked, execute all steps in order — no questions, no preamble. Output the status block, then start working.

---

## Step 1 — Resume Context (silent)

1. Read `~/.claude/projects/-Users-matthewlee-Desktop-DiveDispatch/memory/MEMORY.md`
2. Find the active thread entry (look for `NEXT:` tag or the Active Threads section)
3. Read the thread file to get the exact next action + key file paths
4. Read `CLAUDE.md` to refresh architectural constraints and rules

Do not output anything yet.

---

## Step 2 — TODO Hygiene

Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md`.

### Prune completed items
- Any item with ~~strikethrough~~ or "✓ Done" that appears to have been completed in a prior session → remove from the tier table
- Keep the tier headers even if all items are done (shows progress)

### Detect stale TODOs
For each active (unchecked) TODO:
- If the TODO says "add X to Y" → grep the codebase to check if X already exists in Y → if so, mark done
- If the TODO references a file path that no longer exists → flag for removal
- If two TODOs target the same file with contradictory changes → flag the conflict

### Verify priority
- The first unchecked item in the lowest active tier is the next thing to work on
- **Skip items marked `Human required: Yes`** — print: `Skipped #{N} (human required)`
- If ALL remaining unchecked items are human-required, print: `All remaining items need Matt's input. Listing them:` followed by the list, then STOP — do not auto-start work
- If the `NEXT:` tag in memory points to a different item, note the discrepancy

Write any changes back to TODO.md.

---

## Step 3 — Health Snapshot

```bash
npx vitest run --reporter=json 2>/dev/null
```

From the JSON output, extract:
- Total tests, passing, failing
- Classify files by category (unit/integration/component/hardening/contract/perf/a11y)
- Count test pyramid percentages
- Count components in `src/components/**/*.tsx` that import `useMutation` but have no test in `tests/components/`

---

## Step 4 — Output + Start Working

Print exactly this format:

```
Status — {YYYY-MM-DD}
───────────────────
TODO: {action taken — e.g., "Pruned 3 done items. 14 active across Tiers 3–11."}
{Skipped: #{N} {title} (human required) — for each skipped item, if any}
Next: #{number} {title} (Tier {N}) — {one-line description}
Health: {pass}/{total} passing | Component {pct}% | {N} untested mutation components
{Conflict: {description} OR Conflict: None}
Starting #{number} now.
```

Then immediately begin working on the identified next item. Read the spec from TODO.md if one exists. Read the relevant source files. Follow CLAUDE.md rules. No further prompts — just start coding.

---

## Rules

- **Execute immediately.** No preamble, no recap of what the skill does.
- **30 seconds max** for Steps 1–3. The user wants to start working, not wait for an audit.
- **If tests are failing**, that becomes the next item — fix failing tests before anything else.
- **If no active thread or NEXT tag**, pick the first unchecked item from the lowest active tier.
- **If TODO.md doesn't exist**, create it with a single entry: "Initialize TODO structure."
- **Never ask which item to work on.** Pick the highest-priority unchecked item and start.
