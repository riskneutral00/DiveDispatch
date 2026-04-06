---
name: gate
description: "Pre-commit quality gate. Classifies changes, dispatches review skills, sweeps invariants, detects test gaps, produces GO/NO-GO verdict with CRITICAL/HIGH counts. On NO-GO, auto-fixes fixable findings (max 2 cycles) before reporting. Writes .patrol-ran sentinel. Run before /vault."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill, Agent
user-invocable: true
---

# /gate — Pre-Commit Quality Gate

You are a senior architect reviewing uncommitted changes before they reach `git commit`. Classify what changed, dispatch the right review skills, check invariant-adjacent code, and deliver a GO/NO-GO verdict. Write `.patrol-ran` so `/vault` can read the result.

**Execute immediately. No preamble, no methodology explanation.**

---

## Phase 0: Cache Check + Test Verification

### Step 0a — Compute diff hash

Compute a single hash of the full working-tree state (unstaged + staged + untracked file names):

```bash
DIFF_HASH=$( (git diff; git diff --cached; git ls-files --others --exclude-standard) | shasum -a 256 | awk '{print $1}' )
```

Store `DIFF_HASH` for the entire gate run — it's reused in the sentinel write.

### Step 0b — Full short-circuit

Read `.patrol-ran` if it exists. If **all three** conditions are true:
1. File exists
2. `diffHash` field matches `$DIFF_HASH`
3. `verdict` is not `BLOCKED`

Then **stop immediately** with cached output:

```
Gate — {YYYY-MM-DD}
Cached: {verdict} (unchanged since {ran timestamp})
Critical: {N} | High: {N}
Ready for /vault: YES
```

No skills dispatched. No tests run. No phases executed. Done.

### Step 0c — Test verification (on cache miss)

If no cache hit, run the test suite. If tests fail, nothing else matters.

**5-minute skip:** Check if `.vitest-last-pass` exists and its timestamp is within the last 5 minutes:

```bash
if [ -f .vitest-last-pass ] && [ $(( $(date +%s) - $(cat .vitest-last-pass) )) -lt 300 ]; then echo "SKIP"; else echo "RUN"; fi
```

- If **SKIP** → print `Tests: skipped (passed {N}s ago)` and continue to Phase 1.
- If **RUN** → execute `npx vitest run 2>&1`:
  - If **any tests fail** → mark `TESTS_FAIL = true`. Store the failure output for Phase 7. Continue to Phase 1 (review skills still run — they may find related issues). Phase 7 will attempt to fix test failures before the final verdict.
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

7. Compute per-bucket diff hashes for incremental caching:

```bash
SCHEMA_HASH=$( (git diff -- convex/schema.ts; git diff --cached -- convex/schema.ts) | shasum -a 256 | awk '{print $1}' )
BACKEND_HASH=$( (git diff -- 'convex/**/*.ts' ':!convex/schema.ts' ':!convex/_generated/**'; git diff --cached -- 'convex/**/*.ts' ':!convex/schema.ts' ':!convex/_generated/**') | shasum -a 256 | awk '{print $1}' )
FRONTEND_HASH=$( (git diff -- 'src/app/**' 'src/components/**' 'src/lib/**' 'design-system/**'; git diff --cached -- 'src/app/**' 'src/components/**' 'src/lib/**' 'design-system/**') | shasum -a 256 | awk '{print $1}' )
TESTS_HASH=$( (git diff -- 'tests/**' 'e2e/**'; git diff --cached -- 'tests/**' 'e2e/**') | shasum -a 256 | awk '{print $1}' )
```

8. Read `.patrol-ran`'s `bucketHashes` and `skillResults` (if file exists). For each bucket that has files in it:
   - If the bucket's hash matches the cached `bucketHashes` entry → **skip** that bucket's skills. Reuse `skillResults` from the cached sentinel.
   - If the bucket's hash differs or the bucket has no cached entry → **dispatch** that bucket's skills.

This produces two lists: `skillsToDispatch` (fresh) and `skillsCached` (reused from sentinel).

**Do not output anything yet.**

---

## Phase 2: Scoped Dispatch

Display the dispatch header. Show both fresh and cached skills:

```
Gate — {YYYY-MM-DD}
Changed: {N} files ({schema: N, backend: N, frontend: N, tests: N, config: N})
Dispatching: {comma-separated skillsToDispatch list}
Cached: {comma-separated skillsCached list} (unchanged since {ran timestamp})
───────────────────────
```

If `skillsCached` is empty (first run or all buckets changed), omit the Cached line.

Invoke only `skillsToDispatch` skills **in parallel** using the Skill tool. Each skill runs its full process: inventory → audit → vault review → H-specs → baseline update.

Possible skills (only those in `skillsToDispatch`):
- `/review-backend-schema`
- `/review-backend-auth`
- `/review-backend-mutations`
- `/review-frontend`
- `/review-tests`

After dispatched skills complete, collect each skill's CRITICAL/HIGH/MEDIUM/LOW counts from its final output line. Merge with cached `skillResults` from the sentinel for the full picture.

---

## Phase 3: Invariant Sweep

### Step 3a — Read canonical invariant files

Read ALL architecture invariant files before scanning. These are LAW — violations are findings:

- `Architecture/schema-invariants.md`
- `Architecture/query-invariants.md`
- `Architecture/auth-model.md`
- `Architecture/component-invariants.md`
- `Architecture/fsm-invariants.md`
- `Architecture/error-invariants.md`
- `Architecture/testing-invariants.md`

### Step 3b — Scan for invariant violations

Regardless of which skills ran, if ANY file in the `schema` or `backend` bucket changed:

1. Run `git diff -U0` + `git diff --cached -U0` to get the minimal diff of `convex/` files.
2. Scan added/modified lines (lines starting with `+`) for invariant-adjacent keywords:

| Invariant | Keywords to grep |
|-----------|-----------------|
| 1: Exclusive overlap | `inventoryUnits`, `Exclusive`, `inventoryType`, `overlapping` |
| 2: Pooled blocking | `pooledCount`, `decrement`, `availableCount`, `pooled` |
| 3: Snapshot atomicity | `AvailabilitySnapshot` AND `Reservation` in same hunk |
| 4: Direct status patch | `.patch(` + `status:` on bookings/reservations outside `bookings/status.ts` (fsm-invariants Rule 1) |
| 5: Unbounded collect | `.collect()` without `.take(` on same chain (query-invariants Rule 1) |
| 6: Raw interactive element | `<button`, `<input`, `<select`, `<textarea` in `src/app/` or `src/components/booking/` or `src/components/profiles/` (component-invariants Rule 1) |
| 7: Error shape | `ConvexError` with `message:` instead of `reason:` (error-invariants Rule 1) |
| 8: Auth bypass | `getAuthUser` in mutation files, `checkHasRole` or `assertOwnership` without `authorize()` (auth-model Rule 1) |

3. If any match, add an INVARIANT CHECK entry to the verdict. Items 4-8 are hard blocks (CRITICAL), not informational.

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
Skills dispatched: {freshly-run list}
Skills cached: {reused-from-sentinel list, or "none" if all fresh}

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

**If GO** → skip to Write Sentinel.
**If NO-GO** → fall through to Phase 7 (Auto-Fix Loop).

---

## Phase 7: Auto-Fix Loop (NO-GO only)

Gate stays an orchestrator — all code changes are delegated to spawned fix agents. Max **2 fix-verify cycles**.

### Step 7a — Fixability Triage

Classify each CRITICAL and HIGH finding as `AUTO` or `MANUAL`:

**AUTO** — all of these must be true:
- Has a specific `file:line` reference
- Has a concrete fix description (single action: rename, add call, add guard)
- Targets ≤ 3 files
- Does NOT involve: schema migration, new table/index creation, multi-file architectural refactor, product intent decision

**MANUAL** — any of these:
- No file:line reference (general/architectural concern)
- Fix requires schema migration, new tables, or new indexes
- Finding is invariant-adjacent (from Phase 3 invariant sweep)
- Fix requires product intent decision ("should this notify the customer?")
- Finding spans files across > 2 buckets
- Finding involves state machine transitions in `convex/bookings/`

If **ALL** findings are MANUAL → skip fix loop entirely. Report them and proceed to Write Sentinel as BLOCKED.

### Step 7b — Fix Test Failures First

If tests failed in Phase 0:

1. Spawn 1 fix agent (`model: "sonnet"`, `subagent_type: "build-error-resolver"`) with the test failure output.
   - Agent fixes minimally — no refactoring, just get tests green.
2. After agent completes, re-run `npx vitest run`.
   - If tests **still fail** → exit loop. Proceed to Step 7f (Report) as BLOCKED.
   - If tests **pass** → write timestamp to `.vitest-last-pass`, continue to Step 7c.

### Step 7c — Fix Review Findings

Group `AUTO` findings by the review skill that produced them:

| Skill | Fix Agent Scope |
|-------|----------------|
| `/review-backend-schema` | Schema + data integrity fixes |
| `/review-backend-auth` | Auth, role gate, validator fixes |
| `/review-backend-mutations` | Performance, side effect fixes |
| `/review-frontend` | Component, a11y, design system fixes |
| `/review-tests` | Test health fixes |

For each bucket with `AUTO` findings, spawn **1 fix agent in parallel** (`model: "sonnet"`).

Each fix agent receives:
- The list of findings for its bucket (severity, file:line, description, fix instruction)
- `CLAUDE.md` context (invariants, dependency direction)
- Instruction: **"Apply each fix. Minimal diff. Run `npx tsc --noEmit` after all fixes to verify type safety. Do not change unrelated code."**

After **all** fix agents complete, run `npx vitest run` once to check for regressions.
- If tests fail → treat as a test failure for the next cycle (Step 7b handles it).

### Step 7d — Re-Verify

Re-dispatch **only** the review skills whose buckets had `AUTO` fixes applied. Do not re-dispatch skills for unchanged buckets or MANUAL-only buckets.

Collect new CRITICAL/HIGH counts from re-dispatched skills. Merge with MANUAL findings carried forward.

### Step 7e — Loop or Exit

```
remaining_critical = new CRITICAL count + MANUAL CRITICAL count
remaining_high = new HIGH count + MANUAL HIGH count

if remaining_critical == 0 AND remaining_high == 0:
    → verdict = GO (auto-fixed)
    → exit loop → Write Sentinel
elif cycle < 2:
    → cycle++
    → goto Step 7a with new findings
else:
    → verdict = BLOCKED
    → exit loop → Step 7f → Write Sentinel
```

### Step 7f — Auto-Fix Report

Append to the Phase 6 verdict output:

```
AUTO-FIX REPORT:
───────────────────────
Cycles: {N}/2
Fixed: {N} findings ({comma-separated list})
Remaining: {N} findings ({comma-separated list})

{If MANUAL findings exist:}
REQUIRES HUMAN:
  [{skill-name}] {summary} — {reason it cannot be auto-fixed}

{Updated verdict: GO | BLOCKED}
Ready for /vault: {YES or NO}
```

---

## Write Sentinel

After printing the verdict, write `.patrol-ran` with cache data for incremental reuse:

```bash
VERDICT="CLEAN"
if [ {CRITICAL_COUNT} -gt 0 ] || [ {HIGH_COUNT} -gt 0 ] || [ {TESTS_FAIL} = true ]; then
    VERDICT="BLOCKED"
elif [ {UNREVIEWED_COUNT} -gt 0 ]; then
    VERDICT="CLEAN_UNREVIEWED"
fi

FILE_HASH=$(git log --oneline -1 --format=%h 2>/dev/null || echo "unknown")
```

**If Phase 7 ran**, recompute `DIFF_HASH` and bucket hashes — the fix agents changed files:

```bash
DIFF_HASH=$( (git diff; git diff --cached; git ls-files --others --exclude-standard) | shasum -a 256 | awk '{print $1}' )
```

Write the sentinel as JSON with these fields:

```json
{
  "ran": "{ISO timestamp}",
  "verdict": "{CLEAN|CLEAN_UNREVIEWED|BLOCKED}",
  "headSha": "{short hash}",
  "diffHash": "{DIFF_HASH — recomputed if Phase 7 ran}",
  "critical": {N},
  "high": {N},
  "tests": true,
  "invariants": true,
  "fixCycles": 0,
  "fixedFindings": [],
  "manualFindings": [],
  "bucketHashes": {
    "schema": "{SCHEMA_HASH}",
    "backend": "{BACKEND_HASH}",
    "frontend": "{FRONTEND_HASH}",
    "tests": "{TESTS_HASH}"
  },
  "skillResults": {
    "{skill-name}": {"critical": N, "high": N, "medium": N, "low": N}
  }
}
```

- `fixCycles`: number of auto-fix cycles executed (0 if Phase 7 did not run)
- `fixedFindings`: list of finding descriptions that were resolved by auto-fix
- `manualFindings`: list of finding descriptions classified as MANUAL (require human)

`skillResults` includes both freshly-dispatched and cached skill results (merged). This is what future gate runs read for incremental dispatch.

`DIFF_HASH` and bucket hashes were computed in Phase 0 / Phase 1 and recomputed after Phase 7 if fixes were applied.

Exit code: 0 on GO, 1 on NO-GO.

---

## Rules

- **Dispatch, don't duplicate.** Gate classifies and dispatches. Skills own their domains.
- **Parallel dispatch.** Run all triggered skills simultaneously for speed.
- **Invariant sweep is always on.** Fast safety net even if skills already ran.
- **Test gaps are informational.** They appear in verdict but never block.
- **Config-only changes skip review.** Report them and skip to verdict.
- **Gate orchestrates, not edits.** Gate classifies, dispatches, and orchestrates. Code fixes are delegated to spawned fix agents. Dispatched skills handle their own vault writes + H-specs + baseline updates.
- **Execute immediately.** No preamble. Classify, dispatch, verdict.
