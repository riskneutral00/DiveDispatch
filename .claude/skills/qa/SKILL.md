---
name: qa
description: "Adversarial QA audit. Finds untested side effects, invariant gaps, vault drift, and stale tests. Writes hardening specs to TODO.md."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
user-invocable: true
---

# Adversarial QA Audit

You are a QA architect whose job is to **break** this codebase, not confirm it works. Your mindset is adversarial: "how does this fail in production?" not "does this pass tests?"

**Execute immediately. No preamble, no explanation of methodology. Silent research, findings only.**

---

## Args handling

Check if the user passed `--last`:

**If `--last`:**
1. Read `.claude/qa-last-run` — it contains the commit hash and date of the last full audit
2. If file doesn't exist: output `No previous QA audit recorded. Run /qa to establish baseline.` and stop.
3. Run: `git rev-list --count <saved-hash>..HEAD` to get commits since last audit
4. Run: `git log --oneline <saved-hash>..HEAD` to list what changed
5. Output:
```
Last QA audit: {date}  ({hash})
Commits since: {N}
  {one-line git log}
```
6. **Stop here. Do not run the full audit.**

**If no args (full audit):** Continue to Phase 1.

---

## Phase 1: Inventory (silent)

Build the function-to-test map:

1. Read `convex/schema.ts` — note all tables and indexes
2. Glob `convex/**/*.ts` (exclude `convex/_generated/**`) — collect every exported `mutation`, `query`, `internalMutation`, `internalQuery`
3. Glob `tests/**/*.test.ts`, `src/**/*.test.ts`, `src/**/__tests__/**` — collect all test files
4. For each exported function from step 2: Grep all test files for that function name
5. Collect functions with **ZERO** test file references — these are blind spots

**Do not output anything yet.**

---

## Phase 2: Invariant Audit (silent)

Check every documented rule against test coverage:

1. Read `CLAUDE.md` — extract the "Three Non-Negotiable Invariants" section
2. Read `~/Desktop/DiveVault/DiveDispatch/Architecture/Architecture.md` — extract state machines, transition rules, business constraints
3. Read `~/Desktop/DiveVault/DiveDispatch/Product/TODO.md` — extract the "Current Position" and "Code Health Hardening" sections
4. For each invariant/rule found:
   - Grep test files for keywords that would indicate explicit testing of that invariant
   - An invariant is **covered** only if a test explicitly asserts the invariant outcome (not just calls the function)
   - An invariant is **uncovered** if no test directly asserts its enforcement
5. Skip any invariant already spec'd in TODO.md `### Code Health Hardening` section (H-numbered) — do not duplicate

**Do not output anything yet.**

---

## Phase 3: Side-Effect Hunt (silent)

For each mutation that cascades, check whether downstream writes are tested:

1. Grep for functions that call these cascade helpers:
   - `releaseBookingReservations` — snapshot restoration, reservation vacating
   - `tryAutoAdvance` — status transition, EM auto-release
   - `restoreSnapshotUnits` — availability snapshot increment
   - `notify` or `createNotification` — stakeholder notifications
   - `logBookingChange` — audit trail entries

2. For each caller:
   - Read the mutation code
   - List every `ctx.db.patch`, `ctx.db.insert`, `ctx.db.delete` in the cascade path
   - Check: does any test assert the downstream write's result? (not just that the primary function didn't throw)

3. Focus on these side-effect categories:
   - **Snapshot restoration** after any vacate/release/decline/cancel/expire
   - **Notification creation** after state changes (hold_placed, hold_declined, booking_cancelled)
   - **Audit log entries** after mutations that change booking/reservation status
   - **Session/link cleanup** after booking deletion
   - **TTL/expiresAt changes** after status transitions (edit clears TTL, medical extends TTL)

4. Collect untested side effects grouped by mutation name

**Do not output anything yet.**

---

## Phase 4: Test Quality Scan (silent)

Find weak and stale tests:

### Weak assertions
Grep test files for these patterns:
- `expect(` followed by `.not.toThrow()` — check if the same test also asserts state afterward. If not, it's weak.
- `expect(` followed by `.toBeDefined()` without a subsequent value assertion — tests existence not correctness
- Test functions (`it(` or `test(`) with zero `expect()` calls inside — setup-only, asserts nothing

### Stale references
- Grep test files for function names that appear in `import` statements
- For each imported function, verify it still exists in the source file (Grep source for `export.*functionName`)
- Collect: imports of deleted/renamed functions

**Do not output anything yet.**

---

## Phase 5: Report + Spec Generation

### Categorize findings

Assign each finding a risk tier:
- **CRITICAL** — Invariant violation possible, data corruption, inventory leak, money/booking lost
- **HIGH** — Feature doesn't work as documented, silent failure, state machine bypass
- **MEDIUM** — Side effect missing (notification, audit), cleanup incomplete
- **LOW** — Test quality issue, stale reference, weak assertion

### Present findings

Show a summary table to Matt:

```
QA Audit — {today's date}
  CRITICAL: N  |  HIGH: N  |  MEDIUM: N  |  LOW: N
```

Then list each finding as one line:
```
[CRITICAL] {function name}: {what's not tested} → {target test file}
[HIGH]     {function name}: {what's not tested} → {target test file}
...
```

### Write hardening specs

For each **CRITICAL** and **HIGH** finding:

1. Read TODO.md `### Code Health Hardening` section
2. Find the highest existing H-number (e.g., H7)
3. Append new specs continuing the numbering (H8, H9, ...)
4. Each spec follows this format:

```markdown
#### H{N}: {Title}
**Gap:** {One sentence: what's not tested and why it matters}
**{Extend|New file}:** `{test file path}`
**Functions:** `{functionName}` (`{source file}:{line range}`)

- [ ] {Test case 1}: {Setup}. {Action}. Assert {expected outcome}.
- [ ] {Test case 2}: ...
```

### Update audit baseline

1. Read `~/Desktop/DiveVault/DiveDispatch/Architecture/Lessons.md` — find the "Audit Baseline" table
2. Check if any row's status has changed (e.g., DRY improved, new debt introduced)
3. If changed: update the row. If unchanged: skip silently.

### Flag vault drift

Compare:
- Vault documents behavior X → does code implement X? If not: "Vault ahead of code: {X}"
- Code implements behavior Y → does vault document Y? If not: "Code ahead of vault: {Y}"

Only flag items NOT already listed in TODO.md "What's NOT built" or Phase 3/4/5 sections.

### Save audit marker

After all specs are written, save the current state for `--last`:

```bash
echo "{commit-hash} {date} {CRITICAL}/{HIGH}/{MEDIUM}/{LOW}" > .claude/qa-last-run
```

This file is NOT committed — it's local tracking only. Add to `.gitignore` if not already ignored.

### Final output

```
QA Audit — {date}
  CRITICAL: N  |  HIGH: N  |  MEDIUM: N  |  LOW: N
  Specs written: H{start}–H{end} → TODO.md
  Audit baseline: [updated | unchanged]
  Vault drift: [N items | none]
```

---

## Rules

- **Adversarial mindset only.** You are trying to break the system, not confirm it works. If you find yourself thinking "this looks fine," you're in the wrong mode.
- **Side effects over primary actions.** The most dangerous bugs are in what happens AFTER the function returns. Always ask: "and then what?"
- **Read code AND tests simultaneously.** Never evaluate tests in isolation. Always compare what the mutation does vs what the test asserts.
- **No duplicates.** Check existing H-specs before writing new ones. If a gap is already spec'd, skip it.
- **Concrete over abstract.** Every finding must name a function, a file, and a specific untested behavior. "Test coverage is low" is not a finding. "`expireBooking` doesn't verify snapshot restoration" is.
- **CRITICAL and HIGH get specs. MEDIUM and LOW get listed.** Don't write TODO specs for low-risk findings — just report them.
