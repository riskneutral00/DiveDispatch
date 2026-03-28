---
name: dev-preflight
description: >
  Environment health check. Runs scripts/preflight.sh to verify dev server,
  Convex deployment, Clerk sync, seed data, and zombie processes.
  Returns PASS or FAIL with details. Separate from ticket-level preflight skill.
allowed-tools: Bash, Read
user-invocable: false
---

# dev-preflight — Environment Health Check

Execute immediately. No explanation, no prompts.

**Not the same as the `preflight` skill** — that one resets stale ticket claims and captures test baselines. This one checks that the dev environment is healthy enough to run the app.

---

## Procedure

Run:

```bash
cd /Users/matthewlee/Desktop/RiskNeutral/DiveDispatch && bash scripts/preflight.sh
```

## Interpret Results

- All `[PASS]` or `[FIXED]` → return **PASS**
- Any `[FAIL]` → return **FAIL** with the failing check names and details

## On FAIL

Do NOT proceed with whatever called this skill. Report the failure so the caller can decide whether to:
- Retry after fixing (e.g., `npm run seed:force` for seed failures)
- Abort the operation

## Checks Performed by preflight.sh

| Check | What it does |
|-------|-------------|
| Zombie processes | Kills orphaned node/convex processes |
| Dev server health | Verifies port 3000 is listening, auto-starts tmux if not |
| Convex deployment | Verifies Convex backend is reachable |
| Seed data | Checks core seed data exists |
| Clerk user sync | Verifies Clerk accounts match seed users |
