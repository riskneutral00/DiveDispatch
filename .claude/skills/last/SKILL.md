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

## Step 1 — Run Tests

```bash
npx vitest run 2>&1
```

- If **any tests fail**: stop, fix them, rerun until green. Do not proceed to Step 2 with failing tests.
- Capture: total count, pass count, duration.

---

## Step 2 — Generate Missing Tests

### Classify changed files

```bash
git diff --name-only HEAD 2>/dev/null
git diff --cached --name-only 2>/dev/null
git status --short | awk '{print $2}'
```

Deduplicate. Filter to source files (`.ts`, `.tsx` in `convex/` or `src/`). Exclude `_generated/`, `node_modules/`, `.md`, config.

### For each changed source file

1. Check if a corresponding test file exists (search `tests/`, `src/**/__tests__/`)
2. If no test coverage → select the cheapest test type:

| File pattern | Test type | Template |
|---|---|---|
| `convex/bookings/*.ts` | Integration (convex-test) | `seedUser`, `seedBooking`, `seedInventoryUnit` |
| `convex/*.ts` | Integration (convex-test) | `seedUser` + relevant helpers |
| `src/lib/booking/*.ts` | Unit (pure function) | Direct import, `testDate()` |
| `src/lib/utils/*.ts` | Unit (pure function) | Direct import |
| `src/lib/hooks/*.ts` | Hook (renderHook) | Mock `useQuery`/`useMutation` |
| `src/components/**/*.tsx` | Component (jsdom) | Mock Convex hooks, `render` |

3. Generate tests following DD patterns:
   - Use `testDate(N)` — never hardcoded dates
   - Use `seedFixture` helpers — never raw `ctx.db.insert`
   - Assert outcomes, not implementation
   - Edge cases over happy paths
   - One function, one test home (extend existing files, don't create parallel ones)

4. Run generated tests:
   ```bash
   npx vitest run {new test files}
   ```

5. If a test failure reveals a real bug → note it as a finding. Fix the bug, then make the test pass.

---

## Step 3 — Ticket Reconciliation

`.tickets/` is the single source of truth. Read all `.tickets/DD-*.md` YAML frontmatter.

### Mark completed work
- For each `in_progress` ticket: check if the session's work completed it
- If completed → move to `.tickets/done/`, auto-unblock dependents (scan `blocked_by` fields)
- If partially completed → update the spec body with progress notes

### Re-prioritize
- If the session revealed a new issue more urgent than existing tickets → create a new `.tickets/DD-*.md` (read `.tickets/.counter`, increment)
- If an existing ticket is now blocked by something discovered this session → add to its `blocked_by` field

### Enrich next tickets
For the next **1-3 ready tickets** by priority order:

1. Read the relevant source files to understand current state
2. If the ticket spec is thin, enrich it with:
   - Specific file paths and functions to modify
   - Updated `side_effects` if the code has changed since ticket creation
   - Updated `size` based on current codebase state

3. If a spec references deleted files or completed work → rewrite it
4. If the approach is no longer valid → rewrite it
5. If a ticket describes work already done → move to `.tickets/done/`

### Set up next session
- Update the active memory thread with a `NEXT:` tag pointing to the first ready ticket (e.g., `NEXT: DD-131`)
- This is what `/first` reads to know what to work on

---

## Step 4 — Vault Write Prep

Stage observations for the vault. For each of these that applies to this session, prepare a note:

- **Lessons learned** → will go to `Vaults/DiveDispatch/Architecture/Lessons.md`
- **Decisions made** → will go to `Vaults/DiveDispatch/Architecture/Architecture.md`
- **Patterns discovered** → will go to `Vaults/DiveDispatch/PatternLibrary/`
- **Product observations** → will go to `Vaults/DiveDispatch/Product/`

Don't write these yet — `/vault` handles the actual writes. Just prepare the content so `/vault` can capture it.

- **Skeleton updates** → if any `.SKELETON.md` checklist items changed status this session (tickets fixed, coverage thresholds met, blockers resolved), note them so `/vault` can update the skeleton.

---

## Step 5 — Output

```
Check — {YYYY-MM-DD}
───────────────────
Tests: {pass}/{total} passing {(+N new) if generated}
{Generated: N tests across M files
  {file}: +N ({category})
  ...}
Board: {Completed DD-NNN. | No tickets completed this session.}
Next session tickets enriched:
  DD-{NNN} {title} — {one-line spec summary}
  DD-{NNN} {title} — {one-line spec summary}
Ready for /vault: {YES | NO — fix failing tests first}
```

After printing, write a sentinel file so `/vault` knows `/last` ran:

```bash
echo '{"ran":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","tests":"'${pass}'/'${total}' passing","status":"'${ready_status}'"}' > .last-ran
```

---

## Rules

- **Execute immediately.** No preamble, no methodology explanation.
- **Tests must be green** before proceeding past Step 1. Failing tests block everything.
- **Cheapest test wins.** Don't write a component test when a unit test catches the bug.
- **One function, one test home.** Search before creating. Extend before duplicating.
- **Specs must be actionable.** Not "fix the bug" but "fix TOKEN_EXPIRED in convex/bookingLinks.ts by checking status !== 'Cancelled' before expiry check. Assert: portal works after booking advances to Upcoming."
- **`.tickets/` is the source of truth.** All ticket state lives in YAML frontmatter. `/board sync` mirrors to vault TODO.md.
- **Never skip Step 3.** Even if no tickets were completed, still enrich the next tickets and verify existing specs.
- **The output is for Matt.** Keep it concise. He reads it, then calls `/vault`.
