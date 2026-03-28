---
name: gate
description: "Pre-commit quality gate. Classifies uncommitted changes, dispatches relevant review skills, produces GO/NO-GO verdict. Run before /vault."
allowed-tools: Read, Glob, Grep, Bash, Skill
user-invocable: false
---

# /gate — Pre-Commit Quality Gate

**Execute immediately. No preamble, no methodology explanation.**

---

## Car Flow Detection

Check if Driver merged to main today:

```bash
git log --oneline --since="midnight" HEAD | grep -E '^\w+ (feat|fix|refactor|test)\(DD-'
```

If Car flow active AND no uncommitted changes (`git diff --name-only` + `git diff --cached --name-only` both empty + no untracked files):

1. Print: `Car flow detected — no local changes. GO.`
2. Write sentinel: `echo '{"ran":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","verdict":"GO","critical":0,"high":0,"carflow":true}' > .gate-ran`
3. Exit. (Driver's work was already reviewed by pre-merge-review.)

If Car flow active WITH local changes: continue below, scoped to uncommitted changes only.

---

## Phase 0: Test Verification

**5-minute skip:** If `.vitest-last-pass` timestamp within 300 seconds → skip.
Otherwise run `npx vitest run`. Fail → immediate NO-GO. Pass → write timestamp, continue.

## Phase 1: Diff Classification (silent)

`git diff --name-only` + `git diff --cached --name-only` + untracked. Classify into buckets:

| Bucket | Patterns | Skills |
|--------|----------|--------|
| `schema` | `convex/schema.ts` | `/review-backend-schema` |
| `backend` | `convex/**/*.ts` (not schema, not `_generated/`) | `/review-backend-mutations`, `-auth` |
| `frontend` | `src/app/**`, `src/components/**`, `src/lib/**` | `/review-frontend` |
| `tests` | `tests/**`, `e2e/**`, `*.test.ts` | `/review-tests` |
| `config` | `package.json`, `tailwind.*`, `tsconfig.*` | none |

No changes → `Nothing to gate.` and stop.

## Phase 2: Patrol Sentinel Check

Before dispatching reviews, check if Patrol already reviewed the current diff:

```bash
cat .patrol-ran 2>/dev/null
```

If `.patrol-ran` exists:
1. Parse `fileHash` from sentinel JSON
2. Compute current diff hash: `git diff --name-only | sort | md5`
3. If hashes match → print: `Patrol already reviewed: {skills}. Skipping re-dispatch.`
4. Still run Phase 3 (invariant sweep) and Phase 4 (test gap detection) — these are fast and cheap
5. Skip to Phase 5 with Patrol's finding counts carried forward

If no sentinel or hash mismatch → continue to Phase 2b.

## Phase 2b: Dispatch Reviews

Invoke all triggered skills **in parallel**. Collect CRITICAL/HIGH/MEDIUM/LOW counts.

## Phase 3: Invariant Sweep

If schema/backend changed, grep diff for invariant keywords (Exclusive overlap, Pooled blocking, Snapshot atomicity). Flag matches.

## Phase 4: Test Gap Detection

Source changed without corresponding test → TEST GAP (informational, never blocks).

## Phase 5: GO/NO-GO Verdict

- **NO-GO**: any CRITICAL. `Ready for /vault: NO`
- **GO with warnings**: HIGH/MEDIUM/LOW only. `Ready for /vault: YES`
- **GO clean**: nothing found. `Ready for /vault: YES`

Write sentinel: `echo '{"ran":"...","verdict":"...","critical":N,"high":N}' > .gate-ran`

## Rules

- **Dispatch, don't duplicate.** Gate classifies; skills audit.
- **Invariant sweep always on** for schema/backend changes.
- **Test gaps informational** (MEDIUM at most).
- **Config-only → skip review.**
- **Gate is read-only.** Skills write their own artifacts.
