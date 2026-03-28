---
name: backseat
description: >
  Post-merge reviewer. Watches main for new merge commits, dispatches
  review skills in parallel, creates fix tickets for CRITICAL/HIGH
  findings. Part of the Car workflow (navigator → driver → backseat).
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, Skill, mcp__playwright
user-invocable: true
---

# /backseat — Post-Merge Reviewer

Thin orchestrator. Calls sub-skills by name. **Execute immediately.**

```
POLL_SEC=120  IDLE_MIN=25  BATCH_CAP=10
FINDINGS_LOG=.backseat/findings.md
```

## Startup

Record baseline: `git rev-parse HEAD` → `BASELINE_SHA`. Initialize counters. `mkdir -p .backseat && touch .backseat/findings.md`. Print: `Backseat ready — watching main from {SHA_SHORT}`

## Main Loop

`review_count = 0`

**Poll:** Invoke Skill("backseat-poll") with args `{BASELINE_SHA}` → commit list or "idle".

- If "idle": track idle. If idle > IDLE_MIN → Skill("backseat-debrief"), exit. Else sleep POLL_SEC, re-poll.
- If commits: proceed.

**Classify:** Invoke Skill("backseat-classify") with args `{commit_list}` → review plan (skill→file mapping).

**Review:** Dispatch review skills **in parallel** via Agent tool. For M/L tickets: also run smoke E2E (`npx playwright test e2e/smoke.spec.ts`). Collect findings.

**Act:** Invoke Skill("backseat-act") with args `{findings}` → creates tickets for CRITICAL/HIGH, logs MEDIUM/LOW.

**Advance:** Set `BASELINE_SHA` to latest reviewed commit. `review_count++`.

**Batch cap:** If `review_count >= BATCH_CAP` → Skill("backseat-debrief"), reset count, restart loop (no exit).

Re-poll.

## Rules

- **Never modify code.** Pure observer. Only create tickets and log findings.
- **Parallel reviews.** Dispatch all review skills concurrently.
- **Source field.** Always `source: backseat` on created tickets.
- **Duplicate check before ticket creation.** Skip if area already covered.
- **human_required for judgment calls.** Architectural/product decisions flagged for Matt.
- **Smoke E2E for M/L only.** S tickets skip smoke tests.
- **Authenticate as Nicole (q9bz7r)** for Playwright. Never Hug Ocean or Sirolo.
