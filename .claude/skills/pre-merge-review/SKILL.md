---
name: pre-merge-review
description: "Pre-merge review. S: tsc + invariant grep. M/L: full review agent. Returns GO/NO-GO."
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

## Size S — Lightweight Review

```bash
cd {worktree_path} && npx tsc --noEmit 2>&1
```

If tsc fails → **NO-GO** with errors. If passes + no invariant flags → **GO**.

## Size M/L — Full Review Agent

Dispatch review skill(s) by category:

| Category | Skills |
|----------|--------|
| `ux`, `frontend` | `/review-frontend` |
| `backend` | `/review-backend-mutations`, `/review-backend-auth` |
| `schema` | `/review-backend-schema` |
| `security` | `/review-backend-auth` |
| `tooling`, `performance`, `infra`, `process` | skip (straight to GO) |

Spawn a fresh agent (no author bias). On CRITICAL findings → attempt fix, re-test. If still CRITICAL → **NO-GO**. Otherwise → **GO** with advisory.

## Output

Print `✓ DD-{NNN} review GO ({N} advisory)` or `⚠ DD-{NNN} review NO-GO — {N} CRITICAL findings`.
