---
name: review-backend-mutations
description: "Performance, side effects, and test quality audit. Finds N+1 queries, unbounded fetches, untested side effects, test drift, and weak assertions."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
user-invocable: true
---

# /review-backend-mutations — Performance, Side Effects & Test Quality

You are a senior backend engineer auditing the DiveDispatch Convex backend's runtime behavior. Your job is to find performance risks, untested side effects, and test quality issues — not confirm things work. Adversarial mindset: "what silently breaks after this mutation returns?"

**Execute immediately. No preamble, no explanation of methodology. Silent research, findings only.**

---

## Phase 1: Inventory (silent)

Build the backend map:

1. Read `Architecture/query-invariants.md`, `Architecture/fsm-invariants.md`, `Architecture/error-invariants.md` — the canonical rules. Every finding must be evaluated against these invariants.
2. Read `convex/schema.ts` — all tables, indexes, field types
2. Glob `convex/**/*.ts` (exclude `convex/_generated/**`) — collect every exported `mutation`, `query`, `internalMutation`, `internalQuery`
3. Glob `tests/**/*.test.ts`, `src/**/*.test.ts`, `src/**/__tests__/**` — collect all test files
4. For each exported function from step 2: Grep all test files for that function name → build tested/untested map. Collect functions with **ZERO** test file references — these are blind spots.
5. Read `convex/lib/auth.ts`, `convex/lib/portal.ts`, `convex/lib/validate.ts` — auth and validation patterns
6. Read `convex/bookings/_shared.ts` — state machine guards, shared helpers
7. Read `CLAUDE.md` — invariants, dependency direction
8. Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Architecture/Architecture.md` — state machines, transition rules
9. Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md` — existing H-specs in `### Code Health Hardening` section (note highest H-number, avoid duplicates)
10. Find most recent vault review: `ls ~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/review-backend-mutations-*.md | sort | tail -1`
    - If found: read it, extract the scoreboard values for delta comparison
    - If not found: check `ls ~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/backend-*.md | sort | tail -1` for legacy review
    - If neither found: note "baseline review, no delta"

**Do not output anything yet.**

---

## Phase 2: Audit (silent, 1 Explore agent)

Launch 1 Explore agent focused on performance, side effects, and test quality:

### Performance

- **N+1 queries:** Grep for loops (`for`, `.forEach`, `.map`) containing `ctx.db.get()` or `ctx.db.query()` calls. Each is an N+1.
- **Unbounded fetches:** Grep for `.collect()` NOT preceded by `.take()` on tables that could be large (bookings, reservations, customers, notifications, inventoryUnits, availabilitySnapshots).
- **Missing parallelism:** Find sequential `await` calls on independent queries that could use `Promise.all`.
- **Over-fetching:** Queries that fetch full documents via `.get()` when only 1-2 fields are needed downstream.
- **Read-after-write:** Mutations that read data they just wrote (unnecessary round-trip within the same transaction).

### Side-Effect Hunt

For each mutation calling cascade helpers, read the code and trace downstream writes:
- `releaseBookingReservations` — snapshot restoration, reservation vacating
- `tryAutoAdvance` — status transition, EM auto-release
- `restoreSnapshotUnits` — availability snapshot increment
- `notify` or `createNotification` — stakeholder notifications
- `logBookingChange` — audit trail entries

For each caller:
- List every `ctx.db.patch`, `ctx.db.insert`, `ctx.db.delete` in the cascade path
- Check: does any test assert the downstream write's result? (not just that the primary function didn't throw)

Focus categories:
- **Snapshot restoration** after vacate/release/decline/cancel/expire
- **Notification creation** after state changes (hold_placed, hold_declined, booking_cancelled)
- **Audit log entries** after mutations changing booking/reservation status
- **Session/link cleanup** after booking deletion
- **TTL/expiresAt changes** after status transitions (edit clears TTL, medical extends TTL)

Collect untested side effects grouped by mutation name.

### Test Quality Scan

- **Weak assertions:** `.not.toThrow()` without subsequent state assertion. `.toBeDefined()` without value assertion. These test existence, not correctness.
- **Empty tests:** `test(` or `it(` blocks with zero `expect()` calls — setup only, asserts nothing.
- **Stale references:** Test files importing functions that no longer exist in source (grep import vs grep export).
- **Type bypasses:** `as any` and `as unknown` in test files — each is a schema safety hole.
- **Hardcoded dates:** ISO strings like `"2024-`, `"2025-`, `"2026-` — these are time bombs.

### Test Drift Detection

- **Mock return shape drift:** For every `vi.mock()` in test files, check if the mock's return shape matches the real function's current return type. Flag mismatches.
- **Hook signature drift:** If tests mock `useCurrentUser()`, `useQuery()`, etc., verify the mock's return type matches the current hook signature.
- **Schema drift in seed data:** For every `ctx.db.insert()` in test files, verify inserted fields match current schema. Flag fields that no longer exist, required fields missing from inserts, and invalid enum values.
- **API arg drift:** For every `api.module.function` call in tests, verify args match the current Convex validator. Flag tests passing args the validator would reject.
- **Status/error code drift:** Grep tests for status string assertions (`'Draft'`, `'Upcoming'`) and error code assertions (`'FORBIDDEN'`, `'RESOURCES_INCOMPLETE'`). Verify these are still valid in the source.
- **Stale module paths:** Flag mocks referencing module paths that no longer exist.

**Do not output anything yet.**

---

## Phase 3: Report Generation

### Build the scoreboard

| Metric | How to count |
|--------|-------------|
| Functions total | From Phase 1 step 2 |
| Functions tested | From Phase 1 step 4 (1+ test reference) |
| Functions untested | From Phase 1 step 4 (ZERO test references) |
| N+1 patterns | Count from audit |
| Unbounded collects | Count from audit |
| Missing parallelism | Count from audit |
| Untested side effects | Count from side-effect hunt |
| Weak/empty tests | Count from test quality scan |
| Test drift issues | Count from drift detection |
| Hardcoded dates | Count from test quality scan |

### Categorize all findings

Assign each finding a tier:
- **CRITICAL** — Untested side effect that could corrupt data (snapshot not restored, cascade incomplete)
- **HIGH** — Untested side effect (notification missing, audit gap), N+1 on large table, test drift causing false passes
- **MEDIUM** — Performance risk (unbounded collect, missing parallelism), weak assertions, type bypasses in tests
- **LOW** — Empty tests, stale references, hardcoded dates, over-fetching, read-after-write

### Write vault review

Write to `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/review-backend-mutations-YYYY-MM-DD.md`:

```markdown
# Mutations Review — YYYY-MM-DD

Performance, side effects, and test quality audit.

---

## Scoreboard

| Metric | Value | Delta from last |
|--------|-------|-------------|
| ... | ... | ... |

## Delta from Last Review

### Resolved
- {finding from last review that is now fixed}

### New
- {finding not in last review}

### Regressed
- {finding that got worse since last review}

---

## CRITICAL

### {N}. {Title}
{Description with file:line references}
**Impact:** {What silently breaks}

---

## HIGH / MEDIUM / LOW
(same format)

---

## Untested Side Effects (by mutation)

### {mutationName} (`{file}`)
- [ ] {side effect}: {what should be asserted}

---

## Test Drift

### Mock/Schema Mismatches
- [ ] `{test file}:{line}` — {mock} doesn't match current {source}

### Hardcoded Dates
- [ ] `{test file}:{line}` — `{date string}` will break after {date}

---

## Strengths to Preserve
- {things the test suite and runtime behavior do well}
```

**Show the scoreboard and finding summary to Matt in the terminal.**

---

## Phase 4: TDD Spec Generation

For each **CRITICAL** and **HIGH** finding that can be tested:

1. Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md`
2. Find `### Code Health Hardening` section
3. Find the highest existing H-number (e.g., H12)
4. For each finding, append a new spec continuing the numbering:

```markdown
#### H{N}: {Title}
**Gap:** {One sentence: what's not tested and why it matters}
**{Extend|New file}:** `{test file path}`
**Functions:** `{functionName}` (`{source file}:{line range}`)

- [ ] {Test case 1}: {Setup}. {Action}. Assert {expected outcome}.
- [ ] {Test case 2}: ...
```

5. If a finding is CRITICAL/HIGH but cannot be expressed as a test (e.g., "add Promise.all"), demote it to MEDIUM in the vault report and do NOT write an H-spec for it.
6. TDD priority ordering: untested side effects > test drift > N+1 > weak assertions > hardcoded dates

---

## Phase 5: Update Audit Baseline

1. Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Architecture/Lessons.md` — find the "Audit Baseline" table
2. Check if any row's status has changed (e.g., DRY improved, new debt introduced)
3. If changed: update the row. If unchanged: skip silently.

---

## Final output

```
Mutations Review — {date}
  CRITICAL: N  |  HIGH: N  |  MEDIUM: N  |  LOW: N
  Functions: N tested / N total (N%)
  Untested side effects: N
  Test drift issues: N
  Specs written: H{start}--H{end} -> TODO.md
  Audit baseline: [updated | unchanged]
  Delta: {N resolved, N new, N regressed} vs {last review date}

↳ Vault: review written to Reviews/review-backend-mutations-{date}.md, H-specs to TODO.md, audit baseline [updated|unchanged]
```

---

## Rules

- **Always full scan.** No flags, no args, no diff-only mode. Review everything every time.
- **TDD priority.** Every CRITICAL/HIGH finding must produce a testable spec or be demoted.
- **Adversarial mindset.** "What silently breaks after this returns?" not "does the test pass?"
- **Side effects over primary actions.** The most dangerous bugs are in what happens AFTER the function returns. Always ask: "and then what?"
- **Read code AND tests simultaneously.** Never evaluate tests in isolation. Always compare what the mutation does vs what the test asserts.
- **Concrete findings only.** Every finding names a file, a line number, and a specific issue.
- **No duplicates.** Check existing H-specs in TODO.md AND findings in the last vault review before writing.
- **CRITICAL and HIGH get specs. MEDIUM and LOW get listed.**
- **Complement sibling skills, don't overlap.** `/review-backend-schema` owns schema design, data integrity, invariants, vault drift. `/review-backend-auth` owns auth, security, ownership, role gates, mutation consistency, API surface. This skill owns perf, side effects, test quality, test drift.
- **Execute immediately.** No preamble, no methodology explanation. Silent research, findings only.
