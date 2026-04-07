---
name: analyze
description: "Evidence-driven investigation with competing hypotheses and systematic falsification. Scientific method for debugging."
allowed-tools: Read, Bash, Grep, Glob, Agent, WebSearch, WebFetch
user-invocable: true
---

# /analyze — Hypothesis-Driven Investigation

Structured investigation that generates competing hypotheses, designs falsification tests, and systematically narrows to root cause with evidence. Do not jump to fixes.

**Execute immediately. No preamble.**

## When to Use

- Something is broken and the cause is unclear
- User says `analyze`, `investigate`, `why is this happening`, `root cause`
- Performance degradation, intermittent failures, unexpected behavior
- The problem is ambiguous enough that guessing would waste cycles

## When NOT to Use

- Cause is already known — just fix it
- Simple compilation error — use `/build-fix`
- Code review — use `/review-*` skills
- User wants to plan, not investigate

## Workflow

### Phase 1: Observe

State the symptom precisely. What was actually observed? Include:
- Error messages, stack traces, logs
- Steps to reproduce (if known)
- When it started (if known)
- What changed recently (`git log --oneline -10`)

**Do not interpret yet. Just observe.**

### Phase 2: Hypothesize

Generate 3-5 competing hypotheses for root cause. Each must be:
- **Falsifiable** — there's a test that could disprove it
- **Specific** — names a file, function, config, or mechanism
- **Distinct** — not a restatement of another hypothesis

Default hypothesis lanes (unless the problem suggests better ones):
1. **Code-path / implementation cause** — bug in logic, race condition, wrong state
2. **Config / environment cause** — wrong setting, missing env var, version mismatch
3. **Data / input cause** — unexpected input shape, edge case, stale cache

### Phase 3: Falsify (cheapest test first)

For each hypothesis, design the cheapest test that would disprove it:

| Hypothesis | Falsification Test | Cost |
|------------|-------------------|------|
| Race condition in booking | Add logging around the lock → check order | Low (read + grep) |
| Missing env var | `echo $VAR` in the runtime | Trivial |
| Stale cache | Clear cache → reproduce | Medium |

Execute tests in order of cost (cheapest first). After each test:
- **Falsified** → eliminate hypothesis, move to next
- **Supported** → gather more evidence, but don't stop testing others
- **Inconclusive** → note what's missing, continue

### Phase 4: Narrow

After all tests:
- Rank surviving hypotheses by evidence strength
- Identify the **critical unknown** — the single missing fact that would distinguish remaining candidates
- Design the **discriminating probe** — the one test that collapses remaining uncertainty

Evidence strength hierarchy (strongest to weakest):
1. Direct reproduction / controlled experiment
2. Primary artifacts (logs, traces, configs, git blame)
3. Multiple independent sources converging
4. Single-source code-path inference
5. Circumstantial clues (timing, naming)
6. Intuition / analogy

### Phase 5: Prove and Propose

Once root cause is identified with sufficient evidence:

```
═══════════════════════════════
Analysis — {YYYY-MM-DD}
═══════════════════════════════

Symptom: {what was observed}

Root Cause: {proven cause with evidence}
Confidence: {HIGH / MEDIUM / LOW}

Evidence:
  - {evidence 1 — source, what it shows}
  - {evidence 2}
  - {evidence 3}

Eliminated Hypotheses:
  - {hypothesis} — falsified by {test}: {result}

Remaining Uncertainty:
  - {what's still unknown, if anything}

Proposed Fix:
  - {specific change with file path}
  - {NOT a refactor — minimal fix only}

Verification:
  - {how to confirm the fix works}
```

**Do NOT implement the fix.** Present the analysis. Let the user decide next steps.

## Rules

- **Observe before hypothesizing.** Read the error first.
- **Hypothesize before fixing.** Never jump to code changes.
- **Falsify, don't confirm.** Try to disprove each hypothesis, not prove it.
- **Cheapest test first.** Don't run expensive tests when a quick check would eliminate a hypothesis.
- **Evidence over intuition.** Rank by evidence strength hierarchy.
- **Preserve uncertainty.** If confidence is LOW, say so. Don't fake certainty.
- **Include Convex logs** when investigating backend issues: check `npx convex logs` output.
