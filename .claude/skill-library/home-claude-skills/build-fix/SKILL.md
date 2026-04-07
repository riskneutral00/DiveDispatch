---
name: build-fix
description: "Surgical fix for compilation and type errors. Minimal changes, zero refactoring. Get it compiling, move on."
allowed-tools: Read, Edit, Bash, Grep, Glob
user-invocable: true
---

# /build-fix — Surgical Compilation Fix

Fix build/type errors with the smallest possible change. No refactoring, no improvements, no new abstractions.

**Execute immediately. No preamble.**

## When to Use

- TypeScript compilation errors after code changes
- `npx tsc --noEmit` or `npx vitest run` fails with type errors
- Cascading type errors from a refactor or dependency update
- User says `build-fix`, `fix types`, `fix build`, `make it compile`

## When NOT to Use

- Logic bugs (behavior is wrong) — use `/analyze`
- Code quality issues — use `/ai-slop-cleaner`
- Test failures (not type errors) — use `/ultraqa`
- Architecture problems — use `/review-*` skills

## Workflow

### 1. Diagnose

Run the appropriate check:

```bash
npx tsc --noEmit 2>&1 | head -100
```

Parse errors. Group by:
- **Missing types/imports** — most common, easiest fix
- **Type mismatches** — wrong argument types, return types
- **Missing properties** — interface changes not propagated
- **Convex codegen drift** — `npx convex dev` needs to regenerate types

### 2. Fix (smallest change wins)

For each error group, apply the minimal fix:

| Error Type | Fix Strategy |
|-----------|-------------|
| Missing import | Add the import |
| Missing type | Add type annotation or assertion |
| Wrong argument type | Cast or fix the call site |
| Missing property | Add the property with correct type |
| Convex codegen | Run `npx convex dev` to regenerate `_generated/` |
| Unused variable | Remove it (don't rename to `_var`) |

**Rules for fixing:**
- Fix ONLY what the compiler reports
- No refactoring adjacent code
- No "while I'm here" improvements
- No new abstractions or helpers
- No architectural changes
- Prefer adding a type assertion over restructuring code
- If a fix requires more than 5 lines of change in one file, stop and flag it

### 3. Verify

```bash
npx tsc --noEmit 2>&1
```

- If clean → report success
- If new errors → fix those too (cascade), up to 3 rounds
- If same errors persist after 3 rounds → stop and report as architectural issue

### 4. Report

```
Build Fix — {YYYY-MM-DD}
─────────────────────────
Errors fixed: {N}
Files touched: {list}
Rounds: {N}/3

Changes:
  {file}: {what was fixed}
  {file}: {what was fixed}

Status: {CLEAN | STILL_FAILING}
```

## Rules

- **Smallest possible change.** Period.
- **No refactoring.** Fix the type error, not the design.
- **No new abstractions.** Don't create a helper to avoid a type cast.
- **3 round max.** If it's not compiling after 3 rounds, it's not a build-fix problem.
- **Convex awareness.** Check if `_generated/` is stale before manual type fixes.
- **Next.js awareness.** `next.config.*` and `middleware.ts` type errors may need config changes, not code changes.
