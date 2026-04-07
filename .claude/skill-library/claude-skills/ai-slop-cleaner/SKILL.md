---
name: ai-slop-cleaner
description: "Clean AI-generated code slop with a regression-safe, deletion-first workflow. Locks behavior with tests before touching code."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, Skill
user-invocable: true
---

# /ai-slop-cleaner — Regression-Safe Code Cleanup

Clean AI-generated code bloat without changing behavior. Lock behavior first, then delete.

**Execute immediately. No preamble.**

## When to Use

- User says `deslop`, `anti-slop`, `slop`, or `clean up AI code`
- Code works but feels bloated, repetitive, over-abstracted, or weakly tested
- Follow-up implementation left duplicate logic, dead code, wrapper layers, or boundary leaks
- `--review` flag: reviewer-only pass after cleanup is drafted

## When NOT to Use

- New feature build or product change
- Broad redesign (not incremental cleanup)
- Behavior is too unclear to protect with tests

## Args

| Flag | Behavior |
|------|----------|
| *(none)* | Clean changed files from `git diff --name-only` |
| `<file paths>` | Clean specific files only |
| `--review` | Reviewer-only mode — inspect, don't edit |
| `--dry-run` | Classify slop and plan removals, don't execute |

## Invariant Files

Before classifying or cleaning ANY code, read all architecture invariant files. These are LAW — code that violates them is slop by definition:

- `Architecture/schema-invariants.md`
- `Architecture/query-invariants.md`
- `Architecture/auth-model.md`
- `Architecture/component-invariants.md`
- `Architecture/fsm-invariants.md`
- `Architecture/error-invariants.md`
- `Architecture/testing-invariants.md`

---

## Workflow

### 1. Lock Behavior First

Before touching any code:
- Identify what must stay the same
- Add or run the narrowest regression tests needed
- If tests cannot come first, record the verification plan explicitly
- Use existing vitest patterns. For Convex functions, test via `convexTest` fixtures.

### 2. Write Cleanup Plan

- Bound the pass to the requested files or feature area
- List the concrete smells to remove
- Order from safest deletion to riskiest consolidation

### 3. Classify the Slop

| Category | What to look for |
|----------|-----------------|
| **Dead code** | Unused exports, unreachable branches, stale flags, debug leftovers, `// removed` comments |
| **Duplication** | Repeated logic, copy-paste branches, redundant helpers |
| **Needless abstraction** | Pass-through wrappers, speculative indirection, single-use helper layers, premature generalization |
| **Boundary violations** | Hidden coupling, misplaced responsibilities, wrong-layer imports |
| **Excessive error handling** | Redundant try/catch, validation for impossible scenarios, fallbacks that can't trigger |
| **Comment/docstring bloat** | Obvious comments, redundant JSDoc on self-documenting functions |
| **Missing tests** | Behavior not locked, weak regression coverage |

### 4. One Smell-Focused Pass at a Time

- **Pass 1: Dead code deletion**
- **Pass 2: Duplicate removal**
- **Pass 3: Needless abstraction flattening**
- **Pass 4: Naming and error-handling cleanup**
- **Pass 5: Test reinforcement**

Re-run targeted verification after each pass. Do not bundle unrelated changes.

### 5. Quality Gates

- Regression tests green after each pass
- `npx tsc --noEmit` passes
- `npx vitest run` passes (or skip if timestamp < 5 min, per gate convention)
- If a gate fails, fix or back out the risky cleanup — never force through

### 6. Evidence-Dense Report

Always report:

```
═══════════════════════════════
AI Slop Cleaner — {YYYY-MM-DD}
═══════════════════════════════

Files cleaned: {list}
Lines removed: {N}
Lines added: {N} (test reinforcement only)

Smells removed:
  Dead code: {N} instances
  Duplication: {N} instances
  Needless abstraction: {N} instances
  ...

Behavior lock: {test file(s) added/verified}
Verification: {test output summary}
Remaining risks: {any flagged items}
```

## Review Mode (`--review`)

When `--review` is passed:
1. Do NOT edit files
2. Review the cleanup plan, changed files, and regression coverage
3. Check for: leftover dead code, duplicate logic, needless wrappers, missing tests, behavior-changing cleanup
4. Produce a reviewer verdict with required follow-ups
5. Hand needed changes back to a separate writer pass

## Rules

- **Prefer deletion over addition.** The goal is less code, not different code.
- **Lock behavior before editing.** No exceptions.
- **Keep diffs small and reversible.**
- **Reuse existing utilities** before introducing new ones.
- **Stay scoped.** Do not expand cleanup beyond the requested files.
- **Evidence over claims.** Show test output, not assertions.
