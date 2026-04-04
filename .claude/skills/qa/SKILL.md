---
name: qa
description: >
  QA architect: test generator. Classifies code changes, selects the cheapest effective
  test type, generates tests using DD patterns and fixtures. Reads H-specs from
  /review-tests assessment to know what gaps to fill.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent
user-invocable: true
---

When this skill is invoked, execute all phases in order — no questions, no prompts.

## Args

| Flag | Behavior |
|------|----------|
| *(none)* | Auto-detect changes from `git diff --name-only` + `git status --short` |
| `<file paths>` | Generate tests for specific files only |
| `--from-assessment` | Read H-specs from `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md` and generate tests for each gap found by `/review-tests` |
| `--dry-run` | Classify and plan tests but don't write files |

## Bridge: `--from-assessment`

When `--from-assessment` is used:

1. Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md`
2. Find `### Code Health Hardening` section
3. For each unchecked H-spec (lines starting with `- [ ]`):
   - Parse the gap description, file path, and function name
   - Classify the test type using Phase 2 rules below
   - Generate the test using Phase 4 templates
   - After test passes, check the H-spec checkbox: `- [x]`
4. This is how `/review-tests` findings flow into `/qa` — TODO.md is the memory between them

---

## Phase 1 — Classify Changes

### 1a: Collect changed files

```bash
git diff --name-only HEAD 2>/dev/null
git diff --cached --name-only 2>/dev/null
git status --short | awk '{print $2}'
```

Deduplicate. Filter to source files only (exclude `_generated/`, `node_modules/`, `.md`, config).

If args provided specific files, use those instead.

### 1b: Classify each file

| File pattern | Category | Test pattern |
|---|---|---|
| `convex/bookings/stateMachine.ts` | `hardening` | Pure function: test every invalid transition |
| `convex/bookings/*.ts` | `integration` | `convex-test` with `seedUser`, `seedBooking`, `seedInventoryUnit`, `seedSnapshot` |
| `convex/*.ts` | `integration` | `convex-test` with `seedUser` + relevant seed helpers |
| `src/lib/booking/wizard-state.ts` | `unit` | Pure function: `wizardReducer`, `canAdvance*` gates |
| `src/lib/booking/*.ts` | `unit` | Pure function: direct import, `testDate()` helpers |
| `src/lib/utils/*.ts` | `unit` | Pure function: direct import, no mocks |
| `src/lib/hooks/*.ts` | `hook` | `renderHook()`, mock `useQuery`/`useMutation`/`useCurrentUser` |
| `src/components/booking/*.tsx` | `component` | jsdom, mock Convex hooks, `render` from `tests/helpers/render` |
| `src/components/dashboard/*.tsx` | `component` | jsdom, mock Convex hooks, stub heavy children |
| `src/components/ui/*.tsx` | `component` | jsdom, minimal mocks, test ARIA |
| `src/components/common/*.tsx` | `component` | jsdom, mock heavy dependencies |

Output the classification table silently. Do not display to user yet.

---

## Phase 2 — Test Type Selection

For each classified file, apply CLAUDE.md's test type rules (cheapest test that catches the bug):

1. **Pure function** (validation, calculation, transformation) → **unit test**
2. **Mutation + state transition** (assert the outcome, not the implementation) → **behavioral test**
3. **Multi-step chain** (one operation's output feeds the next) → **integration test**
4. **Frontend↔backend data contract** (does the UI send the right data?) → **contract test** (pure function on the transform layer)
5. **UI rendering** (only if the risk is in rendering, not in logic) → **component test**

### Selection rules

- If a function is pure (no side effects, no DB access) → always unit test, never integration
- If a mutation is tested at the data layer, don't also test it at the component layer
- If a component calls a mutation, test the **data transformation** between component state and mutation args — not the mutation itself
- Edge cases over happy paths. Happy paths are obvious; edge cases are where bugs live.

---

## Phase 3 — Locate or Create Test File

Per CLAUDE.md "one function, one test home":

1. **Search for existing test file** covering the changed function:
   ```bash
   grep -rl "import.*{.*functionName.*}" tests/ src/
   ```

2. **If exists** → extend that file with new `describe`/`it` blocks. Never create a parallel test file.

3. **If not** → create new file following naming convention:

| Category | Location | Naming |
|---|---|---|
| `unit` | `tests/` or `src/lib/**/__tests__/` | `{module-name}.test.ts` |
| `integration` | `tests/` | `{module-name}.test.ts` |
| `hook` | `src/lib/hooks/__tests__/` | `{hook-name}.test.ts` |
| `component` | `tests/components/` | `{component-name}.test.tsx` |
| `hardening` | `tests/hardening/` | `{concept}.test.ts` |
| `contract` | `tests/frontend/` | `{data-flow-name}.test.ts` |
| `perf` | `tests/perf/` | `{concern}.test.ts` |
| `a11y` | `tests/a11y/` | `{scope}.test.tsx` |
| `security` | `tests/hardening/` | `{attack-vector}.test.ts` |

---

## Phase 4 — Generate Tests

### Required patterns (enforced, never deviate)

- **Dates**: Always `testDate(N)` from `tests/helpers/dates`. Never hardcoded `'2026-04-01'`.
- **Seed data**: Always `seedUser()`, `seedBooking()`, etc. from `tests/fixtures/seedFixture`. Never raw `ctx.db.insert`.
- **Assertions**: Assert outcomes, not implementation. No `.toHaveBeenCalledWith()` unless testing that a specific mutation was called.
- **Type safety**: No `as any`. If types don't fit, the fixture is wrong — fix the fixture.
- **Independence**: Each test creates its own state. No shared mutable state between tests.
- **Relative dates**: `addDays(START, N)`. Never `new Date('2026-...')`.

### Template by category

**Unit test:**
```typescript
import { describe, it, expect } from 'vitest'
import { functionUnderTest } from '../../src/lib/...'
import { testDate, addDays } from '../helpers/dates'

describe('functionUnderTest', () => {
  it('returns X when given Y', () => {
    expect(functionUnderTest(input)).toBe(expected)
  })
})
```

**Integration test (convex-test):**
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../../convex/schema'
import { seedUser, seedBooking } from '../fixtures/seedFixture'
import { testDate } from '../helpers/dates'

const modules = import.meta.glob('../../convex/**/*.ts')
let t = convexTest(schema, modules)
beforeEach(() => { t = convexTest(schema, modules) })

describe('mutationUnderTest', () => {
  it('does X when Y', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      // ... setup + assertion
    })
  })
})
```

**Component test:**
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'

// Mock hooks BEFORE import
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return { ...actual, useQuery: () => mockUseQuery(), useMutation: () => vi.fn() }
})

import { ComponentUnderTest } from '@/components/...'

describe('ComponentUnderTest', () => {
  it('renders X when Y', () => {
    const { getByRole } = render(<ComponentUnderTest />)
    expect(getByRole('button', { name: 'Save' })).not.toBeDisabled()
  })
})
```

**Hook test:**
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('convex/react', ...)
import { useHookUnderTest } from '../use-hook-under-test'

describe('useHookUnderTest', () => {
  it('returns X when Y', () => {
    const { result } = renderHook(() => useHookUnderTest())
    expect(result.current.value).toBe(expected)
  })
})
```

---

## Phase 5 — Verify

```bash
npx vitest run {generated test files}
```

- If all pass → move to Phase 6
- If a failure reveals a **real bug** → note it as TDD finding (test written first, code fix needed)
- If a failure is a **test bug** → fix the test and rerun

---

## Phase 6 — Report

```
/qa Report — {date}
═══════════════════════════════

Changed: {N} source files analyzed
Generated: {N} new tests across {M} files

  tests/{file}.test.ts: +{N} ({category})
  tests/{file}.test.ts: +{N} ({category})
  ...

Extended existing: {N} files
Created new:       {M} files

Type distribution:
  Unit: {N} | Integration: {N} | Component: {N}
  Contract: {N} | Hardening: {N} | Hook: {N}

All passing: {YES/NO}
{If TDD findings: "TDD: {N} tests expose bugs that need fixes"}
```

---

## Rules

- **Execute immediately.** No preamble, no methodology explanation.
- **Cheapest test wins.** If a unit test catches the bug, don't write a component test.
- **Data before UI.** The first test for any business rule must be on the function that enforces it, not on the component that displays it.
- **One function, one test home.** Search before creating. Extend before duplicating.
- **Edge cases over happy paths.** Happy paths are obvious; edge cases are where bugs live.
- **State machines need full transition coverage.** Every valid transition tested. Every invalid transition rejected.
- **Never mock what you can import.** Pure functions are tested by calling them directly.
- **Delegate to existing skills when appropriate:**
  - If `/review-tests` findings exist, use them to prioritize which tests to generate
  - If `/review-backend-auth` flagged auth gaps, generate FORBIDDEN/UNAUTHENTICATED tests
  - If `/review-frontend` flagged untested components, generate component tests for those
