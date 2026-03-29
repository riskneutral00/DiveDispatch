---
name: gate
description: "Pre-commit quality gate. Classifies changes, dispatches review skills, sweeps invariants, detects test gaps, produces GO/NO-GO verdict with CRITICAL/HIGH counts. Writes .patrol-ran sentinel. Run before /vault."
allowed-tools: Read, Glob, Grep, Bash, Skill, Agent
user-invocable: true
---

# /gate — Pre-Commit Quality Gate

You are a senior architect reviewing uncommitted changes before they reach `git commit`. Classify what changed, dispatch the right review skills, check invariant-adjacent code, and deliver a GO/NO-GO verdict. Write `.patrol-ran` so `/vault` can read the result.

**Execute immediately. No preamble, no methodology explanation.**

---

## Phase 0: Test Verification

Run the test suite first. If tests fail, nothing else matters.

**5-minute skip:** Before running tests, check if `.vitest-last-pass` exists and its timestamp is within the last 5 minutes:

```bash
if [ -f .vitest-last-pass ] && [ $(( $(date +%s) - $(cat .vitest-last-pass) )) -lt 300 ]; then echo "SKIP"; else echo "RUN"; fi
```

- If **SKIP** → print `Tests: skipped (passed {N}s ago)` and continue to Phase 1.
- If **RUN** → execute `npx vitest run 2>&1`:
  - If **any tests fail** → immediate **NO-GO (BLOCKED)**. Output the failure summary and stop. Write `.patrol-ran` with `BLOCKED`. Do not proceed to Phase 1.
  - If all tests pass → write timestamp: `date +%s > .vitest-last-pass` → capture pass count and continue.

---

## Phase 1: Diff Classification

1. Run `git diff --name-only` + `git diff --cached --name-only` → deduplicated changed file list.
2. Run `git status --short` → check for untracked files. Include in classification.
3. If no changes at all, output `Nothing to gate.` and write CLEAN sentinel. Stop.
4. Classify each file into buckets:

| Bucket | File patterns |
|--------|--------------|
| `schema` | `convex/schema.ts` |
| `backend` | `convex/**/*.ts` excluding `convex/schema.ts` and `convex/_generated/**` |
| `frontend` | `src/app/**`, `src/components/**`, `src/lib/**`, `design-system/**` |
| `tests` | `tests/**`, `e2e/**`, any `*.test.ts` or `*.spec.ts` |
| `config` | `package.json`, `tailwind.config.*`, `tsconfig.*`, `next.config.*`, `.env*` |

A file can land in multiple buckets.

5. Map buckets to skills:

| Bucket | Skills to dispatch |
|--------|-------------------|
| `schema` | `/review-backend-schema` |
| `backend` | `/review-backend-mutations`, `/review-backend-auth` |
| `frontend` | `/review-frontend` |
| `tests` | `/review-tests` |
| `config` | No skill — note in output |

6. Deduplicate the skill list.

**Do not output anything yet.**

---

## Phase 2: Dispatch Reviews

Display the dispatch header:

```
Gate — {YYYY-MM-DD}
Changed: {N} files
Dispatching: {comma-separated skill list}
───────────────────────
```

Invoke all triggered skills **in parallel** using the Skill tool. Each skill runs its full process: inventory → audit → vault review → H-specs → baseline update.

Skills to dispatch (only those triggered by Phase 1):
- `/review-backend-schema`
- `/review-backend-auth`
- `/review-backend-mutations`
- `/review-frontend`
- `/review-tests`

After all skills complete, collect each skill's CRITICAL/HIGH/MEDIUM/LOW counts from its final output line.

---

## Phase 3: Invariant Sweep

Regardless of which skills ran, if ANY file in the `schema` or `backend` bucket changed:

1. Run `git diff -U0` + `git diff --cached -U0` to get the minimal diff of `convex/` files.
2. Scan added/modified lines (lines starting with `+`) for invariant-adjacent keywords:

| Invariant | Keywords to grep |
|-----------|-----------------|
| 1: Exclusive overlap | `inventoryUnits`, `Exclusive`, `inventoryType`, `overlapping` |
| 2: Pooled blocking | `pooledCount`, `decrement`, `availableCount`, `pooled` |
| 3: Snapshot atomicity | `AvailabilitySnapshot` AND `Reservation` in same hunk |

3. If any match, add an INVARIANT CHECK entry to the verdict. These are review flags, not auto-blocks.

---

## Phase 4: Test Gap Detection

For each file in the `schema`, `backend`, or `frontend` bucket, check if there's a corresponding change in the `tests` bucket.

Heuristic: for `convex/foo.ts`, look for `tests/foo.test.ts` or any test file importing from `convex/foo` in the changed file list. For `src/components/Foo.tsx`, look for test files containing `Foo` in the changed file list.

If source changed but no corresponding test changed → TEST GAP entry.

Skip this check if:
- The source change is trivial (only comments or whitespace)
- The file is config/types-only (`.d.ts`, `schema.ts` index changes)

---

## Phase 5: Backseat Queue + Unreviewed Count

Check backseat queue:
```bash
grep -rl 'source: backseat' .tickets/DD-*.md 2>/dev/null | xargs grep -l 'status: ready\|status: in_progress' 2>/dev/null | xargs grep -L 'human_required: true' 2>/dev/null | wc -l
```

If non-zero → add QUEUE WARNING to verdict.

Count unreviewed merges:
```bash
ls .car/merged/*.json 2>/dev/null | wc -l
```

Report in output but doesn't affect verdict.

---

## Phase 6: GO/NO-GO Verdict

Aggregate findings from all dispatched skills + invariant sweep + test gaps + queue check.

Determine **CRITICAL count** and **HIGH count** = sum of all CRITICAL and HIGH findings from dispatched skills (not from test gaps or invariant checks — those are informational).

```
═══════════════════════════════
Quality Gate — {YYYY-MM-DD}
═══════════════════════════════

Changed: {N} files ({schema: N, backend: N, frontend: N, tests: N, config: N})
Skills dispatched: {list}

{GO or NO-GO}
───────────────────────

{If NO-GO — any CRITICAL or HIGH finding:}
BLOCKING:
  [{skill-name}] {summary of each CRITICAL and HIGH finding}

{If MEDIUM/LOW findings exist:}
WARNINGS:
  [{skill-name}] MEDIUM: {N} | LOW: {N}

{If invariant-adjacent changes found:}
INVARIANT CHECK:
  Invariant {N} — {file} touches {concept}. Verify before commit.

{If test gaps found:}
TEST GAPS:
  {file} changed — no corresponding test changes detected

{If backseat queue has non-human_required tickets:}
QUEUE WARNING:
  {N} non-human_required backseat fix tickets still open

Unreviewed: {N} tickets in .car/merged/

{If nothing found by any skill:}
All clear. Clean commit.

Vault artifacts written by: {list of skills that produced vault output}
Ready for /vault: {YES or NO}
```

### Threshold

- **NO-GO** → Any CRITICAL or HIGH finding from any dispatched skill OR tests fail. Verdict = `BLOCKED`.
- **GO** → No CRITICAL or HIGH findings. Verdict = `CLEAN` or `CLEAN_UNREVIEWED` (if unreviewed merges exist).

---

## Write Sentinel

After printing the verdict, write `.patrol-ran`:

```bash
VERDICT="CLEAN"
if [ {CRITICAL_COUNT} -gt 0 ] || [ {HIGH_COUNT} -gt 0 ] || [ {TESTS_FAIL} = true ]; then
    VERDICT="BLOCKED"
elif [ {UNREVIEWED_COUNT} -gt 0 ]; then
    VERDICT="CLEAN_UNREVIEWED"
fi

FILE_HASH=$(git log --oneline -1 --format=%h 2>/dev/null || echo "unknown")
echo '{"ran":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","verdict":"'$VERDICT'","headSha":"'$FILE_HASH'","critical":'$CRITICAL_COUNT',"high":'$HIGH_COUNT',"tests":true,"invariants":true}' > .patrol-ran
```

Exit code: 0 on GO, 1 on NO-GO.

---

## Rules

- **Dispatch, don't duplicate.** Gate classifies and dispatches. Skills own their domains.
- **Parallel dispatch.** Run all triggered skills simultaneously for speed.
- **Invariant sweep is always on.** Fast safety net even if skills already ran.
- **Test gaps are informational.** They appear in verdict but never block.
- **Config-only changes skip review.** Report them and skip to verdict.
- **Gate is read-only.** Dispatched skills handle their own vault writes + H-specs + baseline updates.
- **Execute immediately.** No preamble. Classify, dispatch, verdict.
