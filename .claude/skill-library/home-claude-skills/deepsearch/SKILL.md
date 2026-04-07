---
name: deepsearch
description: "Three-phase codebase exploration: broad search → deep dive → synthesis. Maps usage patterns and architectural insights."
allowed-tools: Read, Bash, Grep, Glob, Agent
user-invocable: true
---

# /deepsearch — Structured Codebase Exploration

Three-phase search that goes beyond grep: maps patterns, traces dependencies, and synthesizes understanding.

**Execute immediately. No preamble.**

## When to Use

- User says `deepsearch`, `deep search`, `find everything about`, `map the codebase`
- Need to understand how a concept is implemented across the codebase
- Need to trace a dependency chain or usage pattern
- Need architectural understanding before making changes

## When NOT to Use

- Know exactly what file/function you need — use Grep/Glob directly
- Looking for a specific string — use Grep
- Want to understand WHY something happened — use `/trace`

## Phases

### Phase 1: Broad Search

Cast a wide net across the codebase:

1. Grep for the target concept (function name, pattern, keyword)
2. Glob for related file patterns
3. Check imports/exports for dependency chains
4. Map which directories/modules touch this concept

Output: list of all relevant files with match counts.

### Phase 2: Deep Dive

For the top 5-10 most relevant files from Phase 1:

1. Read the actual implementations
2. Trace call chains (who calls this? what does this call?)
3. Identify patterns: how is this concept used consistently?
4. Note inconsistencies: where does usage diverge?
5. Check test coverage: are the key paths tested?

### Phase 3: Synthesis

```
═══════════════════════════════
Deep Search: {concept}
═══════════════════════════════

Files: {N} files reference this concept
Modules: {list of directories/modules involved}

Architecture:
  {How the concept is structured — entry points, core logic, consumers}

Usage Patterns:
  - Pattern 1: {description} (seen in {N} files)
  - Pattern 2: {description}

Inconsistencies:
  - {where usage diverges from the dominant pattern}

Key Files:
  - {file:line} — {what it does}
  - {file:line} — {what it does}

Test Coverage:
  - {tested paths}
  - {untested paths}

Dependencies:
  - Upstream: {what this depends on}
  - Downstream: {what depends on this}
```

## Rules

- **Three phases, in order.** Don't skip the broad search.
- **Trace both directions.** Upstream dependencies AND downstream consumers.
- **Note inconsistencies.** Divergent patterns are often bugs or tech debt.
- **Include test coverage.** Untested paths are risk.
- **Be concise in synthesis.** Architecture overview, not line-by-line walkthrough.
