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

## Step 2.5 — Review Changed Code (diff-scoped)

Run review checks ONLY on files changed this session — not a full codebase scan.

```bash
git diff --name-only HEAD 2>/dev/null
```

For each changed file, apply the relevant checks:

| Changed file pattern | Checks |
|---|---|
| `convex/schema.ts` | Verify 3 invariants (exclusive overlap, pooled blocking, snapshot atomicity) are not violated by schema changes. Check new tables have appropriate indexes. |
| `convex/**/*.ts` | Verify `requireAuth()` present in mutations (not `getAuthUser` alone). Check ownership comparisons use auth context. Verify ConvexError codes are consistent (UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, INVALID_STATUS, CONFLICT). |
| `src/components/**/*.tsx` | Check for `useMutation` calls without error handling. Check for missing loading/error states on data-fetching components. Verify new components follow design system (CSS variables, not hardcoded colors — hooks catch most of this). |
| `tests/**/*.test.*` | Check for hardcoded date strings (should use `testDate()`). Check for `as any` (should use typed fixtures). Check for weak assertions (`.toBeDefined()` alone). Check for empty test blocks (no `expect()`). |

Report findings inline:

```
Review: 4 changed files checked
  convex/bookings/create.ts — OK (requireAuth present, ConvexError consistent)
  src/components/dashboard/profile-overlay.tsx — WARN: no error boundary for mutation failure
  tests/frontend/wizard-data-contracts.test.ts — OK (no hardcoded dates, no as any)
```

Do NOT block on warnings — just report them. Fixing is optional (note in vault observations if significant).

Reference: The full audit rules are documented in `.claude/skills/review-backend-auth/SKILL.md`, `.claude/skills/review-backend-mutations/SKILL.md`, `.claude/skills/review-frontend/SKILL.md`, and `.claude/skills/review-tests/SKILL.md`. These skills are reference documentation — `/last` executes their key checks inline.

---

## Step 3 — TODO Reconciliation + Spec Writing

Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md`.

### Mark completed work
- For each item in the current working tier: check if the session's work completed it
- If completed → add ✓ Done with today's date
- If partially completed → note progress inline

### Re-prioritize
- If the session revealed a new issue more urgent than existing TODOs → insert it at the correct tier
- If an existing TODO is now blocked by something discovered this session → note the blocker

### Write specs for next items
For the next **1-3 unchecked TODO items** by priority order:

1. Read the relevant source files to understand current state
2. Write a spec block directly in TODO.md under the item.

   Classify the new fields by analyzing the source files:
   - **Side effects:** Check if the item touches shared utilities, state machines, or test fixtures
   - **Human required:** Set to Yes if the item needs design input, domain knowledge not in docs, or a contradiction resolution
   - **Size:** Count affected files and estimate scope

```markdown
**Spec:** What to change, which files, what the outcome looks like.
**Acceptance:** How to verify it's done (test assertion, visual check, behavior).
**Blocked by:** Any prerequisite that must be done first, or "None".
**Side effects:** Shared modules/areas this touches beyond its primary scope, or "None".
**Human required:** Yes/No — Yes if this needs a design decision, domain input, or spec interview before an agent can start.
**Size:** S/M/L — S=single file <30min, M=2-5 files 30min-2hr, L=5+ files or architectural 2hr+.
```

3. If a spec already exists for the item, verify it's still accurate:
   - Code may have changed since the spec was written
   - If the spec references deleted files or completed work → rewrite it
   - If the approach is no longer valid → rewrite it

4. If a TODO conflicts with current code state (already done, approach invalid) → flag for removal or rewrite

### Set up next session
- Update the active memory thread with a `NEXT:` tag pointing to the first specced item
- This is what `/first` reads to know what to work on

---

## Step 4 — Vault Write Prep

Stage observations for the vault. For each of these that applies to this session, prepare a note:

- **Lessons learned** → will go to `Vaults/DiveDispatch/Architecture/Lessons.md`
- **Decisions made** → will go to `Vaults/DiveDispatch/Architecture/Architecture.md`
- **Patterns discovered** → will go to `Vaults/RiskNeutral/PatternLibrary/`
- **Product observations** → will go to `Vaults/DiveDispatch/Product/`

Don't write these yet — `/vault` handles the actual writes. Just prepare the content so `/vault` can capture it.

- **Skeleton updates** → if any `SKELETON.md` checklist items changed status this session (tickets fixed, coverage thresholds met, blockers resolved), note them so `/vault` can update the skeleton.

---

## Step 5 — Output

```
Check — {YYYY-MM-DD}
───────────────────
Tests: {pass}/{total} passing {(+N new) if generated}
{Generated: N tests across M files
  {file}: +N ({category})
  ...}
TODO: {Marked #N done. | No items completed this session.}
Next session specs written:
  #{N} {title} — Spec: {one-line summary}. Accept: {one-line acceptance}.
  #{N} {title} — Spec: {one-line summary}. Accept: {one-line acceptance}.
Ready for /vault: {YES | NO — fix failing tests first}
```

---

## Rules

- **Execute immediately.** No preamble, no methodology explanation.
- **Tests must be green** before proceeding past Step 1. Failing tests block everything.
- **Cheapest test wins.** Don't write a component test when a unit test catches the bug.
- **One function, one test home.** Search before creating. Extend before duplicating.
- **Specs must be actionable.** Not "fix the bug" but "fix TOKEN_EXPIRED in convex/bookingLinks.ts by checking status !== 'Cancelled' before expiry check. Assert: portal works after booking advances to Upcoming."
- **Never skip Step 3.** Even if no TODOs were completed, still spec the next items and verify existing specs.
- **The output is for Matt.** Keep it concise. He reads it, then calls `/vault`.
