---
name: overstory-review
description: >
  Post-batch Overstory review. Collects git/test/build metrics, compares against
  baseline, checks if the 5 known problems recurred, and rewrites the review doc
  into a before/after structure for Matt's meeting with the Overstory creator.
allowed-tools: Bash, Read, Grep, Glob, Write, Edit
user-invocable: true
---

When this skill is invoked, execute all steps in order — no questions, no prompts.

## Step 0 — Pre-flight

1. Read the baseline file: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/overstory-baseline.md`
2. Extract the **baseline commit hash** (the HEAD commit recorded before the run).
3. If the baseline file doesn't exist or has no commit hash, STOP and tell Matt to run Step 1 of the plan first.

Set `BASELINE` = the extracted commit hash for all subsequent commands.

## Step 1 — Check if `/overstory-walkthrough` was run

Look for screenshots in `/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch/screenshots/`. If the directory is empty or missing, tell Matt:
> "No walkthrough screenshots found. Run `/overstory-walkthrough` first if you want screenshots in the review doc. Continuing without them."

## Step 2 — Collect Post-Run Metrics

Run these commands and record every result:

### Git metrics
```bash
# Merge commits from Overstory
git log --oneline $BASELINE..HEAD | grep -i "overstory\|Merge branch" | wc -l

# Post-merge fix commits
git log --oneline $BASELINE..HEAD | grep "^[a-f0-9]* fix:"

# Revert commits
git log --oneline $BASELINE..HEAD | grep "^[a-f0-9]* revert:"

# Spec changes
git diff $BASELINE --stat -- .overstory/specs/ .overstory/archive/

# Total commits
git log --oneline $BASELINE..HEAD | wc -l

# Full log for reference
git log --oneline $BASELINE..HEAD
```

### Test metrics
```bash
npm test 2>&1 | tail -5
```
Compare test count to baseline (377).

### Build check
```bash
npm run build 2>&1 | tail -10
```

### Convex compile
```bash
npx convex dev --once 2>&1 | tail -10
```

### Overstory runner logs (if available)
```bash
# Run duration — first and last timestamps
head -1 .overstory/logs/runner.log 2>/dev/null
tail -1 .overstory/logs/runner.log 2>/dev/null

# Peak concurrent agents
grep "THROUGHPUT" .overstory/logs/runner.log 2>/dev/null | sort -t'=' -k2 -n | tail -1

# Agent states
grep -c "state=done" .overstory/logs/runner.log 2>/dev/null
grep -c "state=error" .overstory/logs/runner.log 2>/dev/null
grep -c "state=stalled" .overstory/logs/runner.log 2>/dev/null
```

### Overstory databases (if available)
```bash
# Agent count and cost
sqlite3 .overstory/metrics.db "SELECT agent_name, estimated_cost_usd FROM sessions WHERE run_id = (SELECT id FROM runs ORDER BY started_at DESC LIMIT 1);" 2>/dev/null

# Error events
sqlite3 .overstory/events.db "SELECT agent_name, level, COUNT(*) FROM events WHERE level != 'info' GROUP BY agent_name, level;" 2>/dev/null

# Agent final states
sqlite3 .overstory/sessions.db "SELECT state, COUNT(*) FROM sessions GROUP BY state;" 2>/dev/null

# Quality gate failures
sqlite3 .overstory/events.db "SELECT data FROM events WHERE tool_name LIKE '%test%' AND level = 'error';" 2>/dev/null
```

Note: Database paths may vary. If `.overstory/*.db` doesn't exist, check `~/.overstory/` or skip with a note.

## Step 3 — Problem Recurrence Check

For each of the 5 "Before" problems, evaluate whether it recurred:

### Problem 1: Specs before vision
- **Check:** N/A — structural fix (Product Definition exists, PD references in all L6/L7 specs). Skip.
- **Verdict:** Fixed by design.

### Problem 2: Parallel specs → duplicate implementations
- **Check:** `git diff $BASELINE..HEAD` — look for per-role pages or duplicate components that do the same thing for different roles.
- **Look for:** Multiple files like `*-agent-*.tsx`, `*-divemaster-*.tsx` that should be one shared component.
- **Verdict:** Recurred / Did not recur / Partially recurred — with evidence.

### Problem 3: Agents broke things other agents built
- **Check:** Count fix commits from Step 2. Compare to baseline (~10 fix commits in L0-L5).
- **Also check:** Any provider nesting issues, null guard additions, test mock breakage in the fix commits.
- **Verdict:** Improved / Same / Worse — with fix commit count and patterns.

### Problem 4: Premature design work
- **Check:** Count revert commits from Step 2. Look for any large additions immediately followed by reverts.
- **Verdict:** Recurred / Did not recur — with evidence.

### Problem 5: No visual regression catching layout bugs
- **Check:** Did the visual-regression quality gate run? Did it catch anything?
- **Look for:** `visual-regression` in runner logs or events db.
- **Verdict:** Gate ran and caught issues / Gate ran, nothing caught / Gate didn't run — with evidence.

## Step 4 — Rewrite the Review Document

Read the current review doc: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/Overstory Usage Review 2026-03-17.md`

Rewrite it with this structure (target: under 200 lines, ~60% shorter than current). Use the data collected above to fill in every cell and claim.

```markdown
# Overstory Usage Review — DiveDispatch

**Prepared:** 2026-03-17 (updated 2026-03-18)
**Author:** Matt Lee (via Claude)
**Purpose:** Meeting prep — update Overstory creator on real-world usage

---

## Context

[2-3 sentences: what DD is, what Overstory is, why this review exists]

---

## The Numbers

| Metric | Before (L0-L5) | After (L6-L7) | Delta |
|--------|----------------|----------------|-------|
| Specs executed | 79 | [from git] | |
| Agents spawned | ~140 | [from db/logs] | |
| Merge commits | 83 | [from git] | |
| Post-merge fix commits | ~10 | [from git] | |
| Revert commits | 1 (liquid glass) | [from git] | |
| Unit tests | 377 | [from npm test] | |
| Build pass | ✓ | [from npm build] | |
| Estimated cost | [if available] | [from db] | |
| Run duration | [if available] | [from logs] | |
| Quality gates configured | 0 | 6 | +6 |
| New spec template fields | 0 | 6 | +6 |

---

## What Went Wrong (Before — L0-L5)

### 1. Specs before vision
[3-4 lines condensed from current Problem 1]

### 2. Parallel duplicates
[3-4 lines condensed from current Problem 2]

### 3. Agents broke each other's work
[3-4 lines condensed from current Problem 3]

### 4. Premature design (liquid glass)
[3-4 lines condensed from current Problem 4]

### 5. No visual regression
[3-4 lines condensed from current Problem 5]

---

## What I Changed Between Runs

[Bulleted list of the interventions — spec template fields, quality gates, hooks, skills, coordinator lockdown. Keep to ~15 lines.]

---

## Did It Work? (After — L6-L7)

| Problem | Recurred? | Evidence |
|---------|-----------|----------|
| 1. Specs before vision | Fixed by design | PD exists, all specs reference it |
| 2. Parallel duplicates | [Yes/No/Partial] | [evidence] |
| 3. Agents broke things | [Improved/Same/Worse] | [fix commit count + patterns] |
| 4. Premature design | [Yes/No] | [revert count] |
| 5. No visual regression | [Gate ran/didn't] | [evidence] |

[Any NEW issues that emerged — 2-3 lines each if applicable]

---

## Recommendations for Overstory

[Keep and refine current section 4 based on L6/L7 results. 4-6 bullet points.]

---

## Custom Infrastructure Built Around Overstory

[Condensed version of current "Custom Infrastructure" section — table format, ~15 lines]
```

## Step 5 — Include Screenshots (if available)

If `/overstory-walkthrough` screenshots exist in `screenshots/`, pick 2-3 that best show what L6/L7 built. Add them to the doc under a "## What L6/L7 Built" section between "The Numbers" and "What Went Wrong."

## Step 6 — Report

Print a summary for Matt:
- Key metrics (merge count, fix commits, test count delta)
- Problem recurrence verdicts (one line each)
- Any data that couldn't be collected (missing dbs, logs, etc.)
- Link to the updated review doc

End with: "Review doc updated. Read it over before the meeting — flag anything that needs adjusting."
