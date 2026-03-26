---
name: gate
description: "Pre-commit quality gate. Classifies uncommitted changes, dispatches relevant review skills, produces GO/NO-GO verdict. Run before /vault."
allowed-tools: Read, Glob, Grep, Bash, Skill
user-invocable: true
---

# /gate — Pre-Commit Quality Gate

You are a senior architect reviewing uncommitted changes before they reach `git commit`. Your job is to classify what changed, dispatch the right review skill(s), check invariant-adjacent code, and deliver a GO/NO-GO verdict.

**Execute immediately. No preamble, no methodology explanation.**

---

## Phase 0: Test Verification

Run the test suite first. If tests fail, nothing else matters.

```bash
npx vitest run 2>&1
```

- If **any tests fail** → immediate **NO-GO**. Output the failure summary and stop. Do not proceed to Phase 1.
- If all tests pass → capture pass count and continue.

---

## Phase 1: Diff Classification (silent)

1. Run `git diff --name-only` + `git diff --cached --name-only` → deduplicated changed file list.
2. Run `git status --short` → check for untracked files. Include untracked files in the classification.
3. If no changes at all, output `Nothing to gate.` and stop.
4. Classify each file into buckets:

| Bucket | File patterns |
|--------|--------------|
| `schema` | `convex/schema.ts` |
| `backend` | `convex/**/*.ts` excluding `convex/schema.ts` and `convex/_generated/**` |
| `frontend` | `src/app/**`, `src/components/**`, `src/lib/**`, `design-system/**` |
| `tests` | `tests/**`, `e2e/**`, any `*.test.ts` or `*.spec.ts` |
| `config` | `package.json`, `tailwind.config.*`, `tsconfig.*`, `next.config.*`, `.env*` |

A file can land in multiple buckets. That's fine — the triggered skills are complementary, not overlapping.

5. Map buckets to skills:

| Bucket | Skills to dispatch |
|--------|-------------------|
| `schema` | `/review-backend-schema` |
| `backend` | `/review-backend-mutations`, `/review-backend-auth` |
| `frontend` | `/review-frontend` |
| `tests` | `/review-tests` |
| `config` | No skill — note in output |

6. Deduplicate the skill list (a skill appears at most once regardless of how many buckets triggered it).

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

Invoke each skill **sequentially** using the Skill tool. Order:

1. `/review-backend-schema` (if triggered)
2. `/review-backend-auth` (if triggered)
3. `/review-backend-mutations` (if triggered)
4. `/review-frontend` (if triggered)
5. `/review-tests` (if triggered)

Let each skill run its full process: inventory → audit → vault review → H-specs → baseline update.

After each skill completes, note its CRITICAL/HIGH/MEDIUM/LOW counts from its final output line.

---

## Phase 3: Invariant Sweep

Regardless of which skills ran, if ANY file in the `schema` or `backend` bucket changed:

1. Run `git diff -U0` + `git diff --cached -U0` to get the minimal diff of `convex/` files.
2. Scan added/modified lines (lines starting with `+`) for invariant-adjacent keywords:

| Invariant | Keywords to grep |
|-----------|-----------------|
| 1: Exclusive overlap | `inventoryUnits`, `Exclusive`, `inventoryType`, `overlapping` |
| 2: Pooled blocking | `pooledCount`, `decrement`, `availableCount`, `pooled` |
| 3: Snapshot atomicity | `availabilitySnapshots` appearing without `reservations` in the same hunk, or vice versa |

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

## Phase 5: GO/NO-GO Verdict

Aggregate findings from all dispatched skills.

```
═══════════════════════════════
Quality Gate — {YYYY-MM-DD}
═══════════════════════════════

Changed: {N} files ({schema: N, backend: N, frontend: N, tests: N, config: N})
Skills dispatched: {list}

{GO or NO-GO}
───────────────────────

{If NO-GO — any CRITICAL finding:}
BLOCKING:
  [{skill-name}] {summary of each CRITICAL finding}

{If HIGH/MEDIUM/LOW findings exist:}
WARNINGS:
  [{skill-name}] HIGH: {N} | MEDIUM: {N} | LOW: {N}

{If invariant-adjacent changes found:}
INVARIANT CHECK:
  Invariant {N} — {file} touches {concept}. Verify before commit.

{If test gaps found:}
TEST GAPS:
  {file} changed — no corresponding test changes detected

{If nothing found by any skill:}
All clear. Clean commit.

Vault artifacts written by: {list of skills that produced vault output}
Ready for /vault: {YES or NO}
```

### Threshold

- **NO-GO** → Any CRITICAL finding from any skill. `Ready for /vault: NO`
- **GO with warnings** → HIGH/MEDIUM/LOW findings exist but no CRITICAL. `Ready for /vault: YES`
- **GO clean** → No findings. `Ready for /vault: YES`

---

## Rules

- **Dispatch, don't duplicate.** The gate classifies and dispatches. It does NOT re-implement the review skills' audit logic. Each skill owns its domain.
- **Sequential dispatch.** Run one skill at a time so output stays readable and skills don't compete for context.
- **Invariant sweep is always on.** Even if `/review-backend-schema` already ran, the invariant keyword grep is a fast safety net that catches what the full audit might frame differently.
- **Test gaps are informational.** They appear in the verdict but never block (MEDIUM at most). Changing code without changing tests is sometimes intentional.
- **Config-only changes skip review.** If only config files changed, report them and skip to the verdict with "Config changes only — no review skills applicable."
- **The gate is read-only.** It does not write files itself. The dispatched skills handle their own vault writes, H-specs, and baseline updates.
- **Write sentinel after verdict.** After printing the verdict, write `.gate-ran` so `/vault` knows the gate ran:
  ```bash
  echo '{"ran":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","verdict":"{GO|NO-GO}","critical":{N},"high":{N}}' > .gate-ran
  ```
- **Execute immediately.** No preamble, no methodology explanation. Classify, dispatch, verdict.
