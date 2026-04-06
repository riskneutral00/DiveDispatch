---
name: review-tests
description: >
  Test health scan. Runs vitest + optionally playwright, evaluates test quality
  against project rules, reports findings, writes H-specs for CRITICAL+HIGH findings.
allowed-tools: Bash, Read, Grep, Glob, Write
user-invocable: true
---

When this skill is invoked, execute all steps in order — no questions, no prompts.

## Args

| Flag | Behavior |
|------|----------|
| *(none)* | Vitest + quality scan + QA health assessment (full default) |
| `--full` | Above + Playwright E2E |
| `--e2e` | Playwright E2E only |
| `--quality` | Skip test execution, quality scan + assessment only (Phases 2–3) |

---

## Phase 1 — Execute Test Suites

Skip this phase if `--quality` flag is set.

### 1a: Vitest (skip if `--e2e` only)

```bash
cd ~/Desktop/RiskNeutral/DiveDispatch && npm test 2>&1
```

Capture: total test count, pass count, fail count, skip count, duration.
If any tests fail, record every failing test name + error message verbatim.

### 1b: Coverage (skip if `--e2e` only)

```bash
cd ~/Desktop/RiskNeutral/DiveDispatch && npm run test:coverage 2>&1
```

Capture: statement %, branch %, function %. Threshold is **40% statements** (from `vitest.config.ts`).

### 1c: Playwright (only if `--full` or `--e2e`)

```bash
cd ~/Desktop/RiskNeutral/DiveDispatch && npx playwright test 2>&1
```

Capture: total spec count, pass count, fail count, duration.

**If any suite has failures, that is the headline finding.** Quality scan still runs, but failures dominate the report.

---

## Phase 1.5 — Read Testing Invariants

Read `Architecture/testing-invariants.md` — the canonical testing rules. Use these as the quality criteria for Phase 2 scanning. Violations of these rules are findings.

---

## Phase 2 — Test Quality Scan

Scan all files matching `tests/**/*.test.ts`, `tests/**/*.test.tsx`, `e2e/**/*.spec.ts`.

For each violation, record: `{file}:{line} — {rule} — {snippet}`.

### Rule 1: No hardcoded dates — HIGH

Grep for ISO date literals and Date constructor with string args:
- `['"]20\d{2}-\d{2}-\d{2}` — date string literals
- `new Date\(['"]` — Date constructor with hardcoded string

Exclude: `tests/helpers/dates.ts`, comments, snapshot files.

### Rule 2: No `as any` type bypasses — HIGH

Grep for:
- `as any`
- `as unknown as`

Exclude: `.d.ts` files.

### Rule 3: No shared mutable state — MEDIUM

Grep for:
- `let ` declarations at module scope (outside `describe`/`it`/`test` blocks) that are later reassigned
- Variables set in `beforeAll` but not reset in `beforeEach`

### Rule 4: Weak assertions — MEDIUM

Grep for:
- `.toBeDefined()` as the only assertion in an `it`/`test` block
- `.toBeTruthy()` / `.toBeFalsy()` (prefer specific matchers)
- `it(` or `test(` blocks with zero `expect()` calls

### Rule 5: Implementation-coupled assertions — LOW

Grep for:
- `.toHaveBeenCalledWith(`
- `.toHaveBeenCalledTimes(`

Flag and count. Not always wrong — report as informational.

### Rule 6: Stale imports — HIGH

For each test file, extract imported function names from `import { ... } from` statements pointing at project source (`convex/`, `lib/`, `src/`). Verify each imported name still exists as an export in the source file. Flag imports of functions that no longer exist.

### Rule 7: Hardcoded IDs — MEDIUM

Grep for:
- UUID-like patterns: `[0-9a-f]{8}-[0-9a-f]{4}-`
- Convex-style IDs outside of test helpers/fixtures

### Rule 8: Duplicate test homes — LOW

Check for multiple test files with `describe(` blocks referencing the same function name. The project rule is "one function, one test home."

---

## Phase 3 — Structural Health

### 3a: Fixture adoption

- Count test files that import from `tests/fixtures/seedFixture` or similar seed helpers
- Count test files that insert directly into db without shared fixtures
- Report: `{N}/{total} test files use shared fixtures ({pct}%)`

### 3b: Date helper adoption

- Count test files that import from `tests/helpers/dates`
- Report: `{N}/{total} test files use date helpers ({pct}%)`

### 3c: Test distribution

Count files by type:
- Backend: files using `convexTest`
- Component: files using `render` from testing-library
- Pure unit: everything else in `tests/`
- E2E: files in `e2e/`

Report distribution table.

### 3d: E2E health (only if `--full` or `--e2e`)

- Count specs with `test.skip` or `test.fixme`
- Count specs using `page.waitForTimeout` (brittle waits)
- Count specs with hardcoded `localhost` URLs or ports

---

## Phase 3.5a — QA Health Assessment

Always runs. This is the core of the QA architect's report.

### Test Pyramid Breakdown

Run `npx vitest run --reporter=json` and classify each test file:

| Classifier | Category |
|---|---|
| File in `tests/hardening/` | Hardening |
| File in `tests/walkthrough/` | Walkthrough |
| File in `tests/frontend/` | Contract |
| File in `tests/perf/` | Performance |
| File in `tests/a11y/` | Accessibility |
| File in `tests/components/` | Component |
| File uses `convexTest` or imports `convex-test` | Integration |
| File uses `render` from `@testing-library` or `tests/helpers/render` | Component |
| File in `src/lib/**/__tests__/` | Unit |
| Everything else in `tests/` | Unit |

Count passing tests per file from JSON output. Report:

```
Test Pyramid
────────────
Unit:        {N} tests ({pct}%)  — {files} files
Integration: {N} tests ({pct}%)  — {files} files
Component:   {N} tests ({pct}%)  — {files} files
Hardening:   {N} tests ({pct}%)  — {files} files
Contract:    {N} tests ({pct}%)  — {files} files
Perf:        {N} tests ({pct}%)  — {files} files
Security:    {N} tests ({pct}%)  — {files} files
A11y:        {N} tests ({pct}%)  — {files} files
E2E:         {N} tests ({pct}%)  — {files} files
Total:       {N} tests

⚠ Component at {pct}% (target: 15%)
⚠ E2E at 0% (target: 5%)
```

### Untested Component Inventory

Scan `src/components/**/*.tsx`. For each, search `tests/components/` for a matching test. Classify risk:

- **HIGH RISK**: component file contains `useMutation` or `useAction` (writes data)
- **MEDIUM RISK**: component file contains `onClick`, `onChange`, or `<form`
- **LOW RISK**: pure display component

```
Untested Components ({N}/{total})
─────────────────────────────────
HIGH RISK (mutations/forms):
  {path} — no test
  ...

MEDIUM RISK (interactive):
  {path} — no test
  ...
```

### Test Category Gaps

| Category | Directory | Minimum | Status |
|---|---|---|---|
| Hardening | `tests/hardening/` | 3+ files | ✓ or ✗ |
| Performance | `tests/perf/` | 1+ files | ✓ or ✗ |
| Security | `tests/hardening/*sanitization*` or `*security*` | 1+ files | ✓ or ✗ |
| Accessibility | `tests/a11y/` | 1+ files | ✓ or ✗ |
| Frontend contracts | `tests/frontend/` | 1+ files | ✓ or ✗ |

Missing categories → HIGH finding.

### Data-Flow Gap Analysis

For each `src/components/**/*.tsx` that imports `useMutation`:
1. Extract mutation name (e.g., `api.bookings.status.cancelBooking`)
2. Search `tests/` for a test that imports or references that mutation
3. If no test → flag as data contract gap

```
Data-Flow Gaps ({N} mutations without contract tests)
────────────────────────────────────────────────────
  {component} → {mutation} — UNTESTED
  ...
```

### Assessment Score

```
Assessment Score: {N}/100
─────────────────────────
  Pyramid balance:    {N}/25  (target: unit 30%, integration 45%, component 15%, other 10%)
  Component coverage: {N}/25  (% of mutation-calling components with tests)
  Category gaps:      {N}/25  (all 5 categories present = 25)
  Data contracts:     {N}/25  (% of mutations with contract tests)
```

### H-Specs from Assessment

For each HIGH RISK untested component and each data-flow gap, write an H-spec to TODO.md (same format as Phase 3.5b below). These H-specs are the **bridge to `/qa`** — run `/qa --from-assessment` to generate tests for them.

### Cadence

```
Recommended: Run /review-tests --assessment weekly or before major releases.
Last assessment: {date from most recent vault report, or 'never'}
```

---

## Phase 3.5b — TDD Spec Generation

For each **CRITICAL** and **HIGH** finding that is actionable (fixable, not just reportable):

1. Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md`
2. Find `### Code Health Hardening` section
3. Find the highest existing H-number
4. For each finding, append a new spec:

```markdown
#### H{N}: {Title}
**Gap:** {One sentence: what's wrong and why it matters}
**{Extend|New file}:** `{test file path}`
**Functions:** `{functionName}` (`{source file}:{line range}`)

- [ ] {Fix 1}: {What to change}. Assert {expected outcome after fix}.
```

5. Hardcoded dates → H-spec to replace with date helper
6. `as any` bypasses → H-spec to add proper types
7. Stale imports → H-spec to remove or update import
8. Assertion-free tests → H-spec to add meaningful assertions
9. Skip findings already covered by existing H-specs

---

## Phase 4 — Report

### Tiering

| Tier | Triggers |
|------|----------|
| CRITICAL | Test failures (Phase 1), stale imports to deleted functions |
| HIGH | Hardcoded dates, `as any` bypasses, assertion-free test blocks |
| MEDIUM | Weak assertions, shared mutable state, hardcoded IDs, low fixture adoption |
| LOW | Implementation-coupled assertions, duplicate test homes, brittle E2E waits |

### Quality score

Start at 100, deduct:
- Each CRITICAL finding: **-15**
- Each HIGH finding: **-5**
- Each MEDIUM finding: **-2**
- Each LOW finding: **-1**
- Any test failures: **-25** (flat, not per failure)
- Coverage below 40% threshold: **-10**
- Floor at 0

### Console output

Print this report directly to the conversation:

```
Test Health Scan — {date}
═══════════════════════════════

Suite Results
─────────────
  Vitest:     {pass}/{total} passed ({duration})
  Coverage:   {stmt}% stmts | {branch}% branches | {fn}% functions
  Threshold:  {pass/fail} (40% statements)
  [Playwright: {pass}/{total} passed ({duration})]

Quality Score: {score}/100
─────────────────────────
  CRITICAL: {N}  |  HIGH: {N}  |  MEDIUM: {N}  |  LOW: {N}

Findings
────────
[CRITICAL] {file}:{line} — {description}
[HIGH]     {file}:{line} — {description}
...

Structural Health
─────────────────
  Fixture adoption:  {N}/{total} files ({pct}%)
  Date helper usage: {N}/{total} files ({pct}%)
  Test distribution: {backend} backend | {component} component | {unit} unit | {e2e} E2E
  [Skipped E2E:     {N} specs]
  Specs written: H{start}–H{end} → TODO.md
```

### Vault report

Write the full report (same structure, with all findings listed per rule) to:
`~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/test-health-{YYYY-MM-DD}.md`

### Delta tracking

Check for a previous report:
```bash
ls ~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/test-health-*.md | sort | tail -2
```

If a previous report exists, compare quality score, finding counts by tier, and coverage. Append a `## Delta` section to the vault report showing changes since last scan.

---

## Rules

- **Execute immediately.** No preamble, no methodology explanation.
- **Do not modify test files.** This is a read-only audit.
- **CRITICAL and HIGH get specs. MEDIUM and LOW get listed.**
- **Concrete findings only.** Every finding names a file, a line, and the violation. No vague advice.
- **Test pyramid awareness.** Note if distribution is top-heavy (too many E2E, not enough unit).
