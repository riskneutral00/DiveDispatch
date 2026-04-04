---
name: pre-merge-review
description: "Pre-merge review. All sizes: tsc + invariant grep + review skill by category. Returns GO/NO-GO."
allowed-tools: Read, Bash, Grep, Glob, Agent
user-invocable: false
---

# pre-merge-review

Called by Driver agent after worker completes. Args: `{ticket_id} {size} {category} {worktree_path}`

## Invariant Sweep (all sizes, if convex/ changed)

```bash
git diff --name-only main..ticket/DD-{NNN} | grep '^convex/'
```

If matches, grep the diff for:

| Invariant | Keywords |
|-----------|----------|
| 1: Exclusive overlap | `inventoryUnits`, `Exclusive`, `inventoryType`, `overlapping` |
| 2: Pooled blocking | `pooledCount`, `decrement`, `availableCount`, `pooled` |
| 3: Snapshot atomicity | `availabilitySnapshots` without `reservations` in same hunk |

Flag matches as `INVARIANT CHECK: {invariant N} — {file} touches {concept}`.

## All Sizes — Full Review

```bash
cd {worktree_path} && npx tsc --noEmit 2>&1
```

If tsc fails → **NO-GO** with errors.

Dispatch review skill(s) by category (ALL sizes — Backseat is advisory-only, so pre-merge is the only gate that can NO-GO a worker):

| Category | Skills |
|----------|--------|
| `ux`, `frontend` | `/review-frontend` |
| `backend` | `/review-backend-mutations`, `/review-backend-auth` |
| `schema` | `/review-backend-schema` |
| `security` | `/review-backend-auth` |
| `tooling`, `performance`, `infra`, `process` | skip (straight to GO) |

Spawn a fresh agent (no author bias). On CRITICAL findings → attempt fix, re-test. If still CRITICAL → **NO-GO**. Otherwise → **GO** with advisory.

## Branch Validation (all sizes, all categories)

Before issuing GO, run the merge validator:

```bash
cd {worktree_path} && bash scripts/validate-merge.sh ticket/DD-{NNN}
```

If it exits non-zero → **NO-GO** with the validator output. This catches duplicate test files, zero-value tests, `as any` casts, and test suite failures that the worker may have introduced.

## Output

Print `✓ DD-{NNN} review GO ({N} advisory)` or `⚠ DD-{NNN} review NO-GO — {N} CRITICAL findings`.
