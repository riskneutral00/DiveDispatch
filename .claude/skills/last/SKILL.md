---
name: last
description: >
  Pre-vault quality check. If Patrol has run, reads its observations and verifies.
  If no Patrol, falls back to running tests, QA, and reconciliation directly.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent
user-invocable: true
---

When this skill is invoked, execute all steps in order — no questions, no preamble.

---

## Patrol Detection

Check if Patrol agent already ran:

```bash
cat .patrol-ran 2>/dev/null
cat .patrol-observations.md 2>/dev/null
```

If `.patrol-ran` exists with today's timestamp → **Patrol flow.** Print: `Patrol completed — reading prepared observations.`

If no Patrol signal → **Manual flow.** Run Steps 1-4 below.

---

## Patrol Flow (fast path)

1. Read `.patrol-observations.md` — lessons, patterns, coverage delta, blocked diagnosis.
2. Verify tests are still green: `npx vitest run 2>&1`. If failing → fix before proceeding.
3. Read `.gate-ran` — confirm GO verdict. If NO-GO → flag for Matt.
4. Skip to Step 5 (Output).

---

## Manual Flow (no Patrol)

### Step 1 — Run Tests

```bash
npx vitest run 2>&1
```

- If **any tests fail**: stop, fix them, rerun until green. Do not proceed with failing tests.
- Capture: total count, pass count, duration.

### Step 2 — Generate Missing Tests

Classify changed files. Filter to `.ts`/`.tsx` in `convex/` or `src/`. Exclude `_generated/`, `node_modules/`, `.md`, config.

For each changed source file without test coverage, select cheapest test type and generate following DD patterns (`testDate(N)`, seed fixtures, assert outcomes, one test home).

Run generated tests. If failure reveals a real bug → note it, fix it.

### Step 3 — Ticket Reconciliation

`.tickets/` is the single source of truth. Read all `.tickets/DD-*.md` YAML frontmatter.

- Mark completed tickets → move to `done/`, auto-unblock dependents
- Re-prioritize if session revealed urgent new issues
- Enrich next 1-3 ready tickets with file paths, updated side_effects/size
- Update active memory thread with `NEXT:` tag

### Step 4 — Vault Write Prep

Stage observations: lessons learned, decisions, patterns, product observations, skeleton updates. Don't write yet — `/vault` handles actual writes.

---

## Step 5 — Output

```
Check — {YYYY-MM-DD}
───────────────────
Source: {Patrol | Manual}
Tests: {pass}/{total} passing {(+N new) if generated}
Board: {Completed DD-NNN. | No tickets completed.}
Gate: {GO | NO-GO | not run}
Next session tickets enriched:
  DD-{NNN} {title} — {summary}
Ready for /vault: {YES | NO}
```

Write sentinel: `echo '{"ran":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","source":"...","status":"..."}' > .last-ran`

---

## Rules

- **Execute immediately.** No preamble.
- **Patrol flow is the fast path.** If Patrol ran, trust its work — just verify tests green.
- **Tests must be green** before proceeding past Step 1.
- **Cheapest test wins.** Unit > behavioral > integration > E2E.
- **One function, one test home.** Search before creating.
- **`.tickets/` is the source of truth.** `/board sync` mirrors to vault.
- **Never skip reconciliation.** Always enrich next tickets (Patrol or manual).
- **The output is for Matt.** Keep it concise.
