---
name: last
description: >
  Pre-vault quality check. Runs tests, generates missing tests for changed files,
  reconciles TODO.md (mark done, write specs for next items), prepares vault observations.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent
user-invocable: true
---

When this skill is invoked, execute all steps in order — no questions, no preamble.

---

## Car Flow Detection

Check if Driver merged to main today:

```bash
git log --oneline --since="midnight" HEAD | grep -E '^\w+ (feat|fix|refactor|test)\(DD-'
```

If matches found → **Car flow active.** Print: `Car flow detected — scoping to uncommitted changes only.`

When Car flow is active, Steps 2 and 3 scope to **uncommitted changes only** (not the full diff that includes Driver's merged work). Use `git diff --name-only` + `git diff --cached --name-only` instead of `git diff --name-only HEAD`.

---

## Step 1 — Run Tests

```bash
npx vitest run 2>&1
```

- If **any tests fail**: stop, fix them, rerun until green. Do not proceed with failing tests.
- Capture: total count, pass count, duration.

---

## Step 2 — Generate Missing Tests

Classify changed files (scoped per Car flow detection above). Filter to `.ts`/`.tsx` in `convex/` or `src/`. Exclude `_generated/`, `node_modules/`, `.md`, config.

For each changed source file without test coverage, select cheapest test type and generate following DD patterns (`testDate(N)`, seed fixtures, assert outcomes, one test home).

Run generated tests. If failure reveals a real bug → note it, fix it.

---

## Step 3 — Ticket Reconciliation

`.tickets/` is the single source of truth. Read all `.tickets/DD-*.md` YAML frontmatter.

- Mark completed tickets → move to `done/`, auto-unblock dependents
- Re-prioritize if session revealed urgent new issues
- Enrich next 1-3 ready tickets with file paths, updated side_effects/size
- Update active memory thread with `NEXT:` tag

---

## Step 4 — Vault Write Prep

Stage observations: lessons learned, decisions, patterns, product observations, skeleton updates. Don't write yet — `/vault` handles actual writes.

---

## Step 5 — Output

```
Check — {YYYY-MM-DD}
───────────────────
Tests: {pass}/{total} passing {(+N new) if generated}
Board: {Completed DD-NNN. | No tickets completed.}
Next session tickets enriched:
  DD-{NNN} {title} — {summary}
Ready for /vault: {YES | NO}
```

Write sentinel: `echo '{"ran":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","tests":"...",status":"..."}' > .last-ran`

---

## Rules

- **Execute immediately.** No preamble.
- **Tests must be green** before proceeding past Step 1.
- **Cheapest test wins.** Unit > behavioral > integration > E2E.
- **One function, one test home.** Search before creating.
- **`.tickets/` is the source of truth.** `/board sync` mirrors to vault.
- **Never skip Step 3.** Always enrich next tickets.
- **The output is for Matt.** Keep it concise.
