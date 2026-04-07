---
name: ultraqa
description: "Autonomous QA cycling: test → diagnose → fix → repeat until goal met. Max 5 cycles. Stops early on repeated failures."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent
user-invocable: true
---

# /ultraqa — Autonomous QA Cycling

Run test/build/lint → diagnose failures → fix → repeat until clean. Max 5 cycles.

**Execute immediately. No preamble.**

## When to Use

- Tests failing and you want autonomous fix cycling
- Build broken after changes
- User says `ultraqa`, `fix tests`, `make tests pass`, `fix build`
- Post-implementation QA before commit

## Args

| Flag | Behavior |
|------|----------|
| `--tests` | All test suites pass (`npx vitest run`) |
| `--build` | Build succeeds (`npx tsc --noEmit`) |
| `--lint` | No lint errors |
| `--typecheck` | No TypeScript errors (`npx tsc --noEmit`) |
| `--all` | Tests + build + typecheck |
| `--custom "pattern"` | Custom success pattern in output |
| *(none)* | Default: `--tests` |

## Cycle Workflow

### Cycle N/5

1. **RUN**: Execute verification command based on goal type
2. **CHECK**: Did the goal pass?
   - **YES** → Exit with success
   - **NO** → Continue to step 3
3. **DIAGNOSE**: Analyze failure output. Identify root cause.
   - For test failures: which tests, what assertions, what's the actual vs expected
   - For build failures: which files, what type errors
4. **FIX**: Apply minimal targeted fix
   - Fix the failing code, not the test (unless the test is wrong)
   - Smallest possible change
5. **REPEAT**: Back to step 1

## Progress Output

```
[UltraQA 1/5] Running tests...
[UltraQA 1/5] FAILED — 3 tests failing in auth.test.ts
[UltraQA 1/5] Diagnosing: missing mock for useAuth hook
[UltraQA 1/5] Fixing: auth.test.ts — add useAuth mock
[UltraQA 2/5] Running tests...
[UltraQA 2/5] PASSED — All 47 tests pass
[UltraQA COMPLETE] Goal met after 2 cycles
```

## Exit Conditions

| Condition | Action |
|-----------|--------|
| **Goal met** | `UltraQA COMPLETE: Goal met after N cycles` |
| **Cycle 5 reached** | `UltraQA STOPPED: Max cycles. Remaining failures: ...` |
| **Same failure 3x** | `UltraQA STOPPED: Same failure 3 times. Root cause: ...` |

## Rules

- **Fix the code, not the test** — unless the test expectation is genuinely wrong
- **Track failures** — detect patterns across cycles
- **Early exit on repetition** — 3x same failure = fundamental issue, stop
- **Parallel diagnosis** when multiple independent failures exist
- **No refactoring** — fix what's broken, nothing more
