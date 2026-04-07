---
name: trace
description: "Evidence-driven causal investigation with 3 parallel hypothesis lanes, rebuttal rounds, and ranked synthesis. Explains WHY something happened."
allowed-tools: Read, Bash, Grep, Glob, Agent
user-invocable: true
---

# /trace — Causal Investigation

Investigate WHY something happened through competing hypotheses, parallel evidence gathering, and systematic falsification. Do not jump to fixing.

**Execute immediately. No preamble.**

## When to Use

- User wants to understand WHY (not just fix it)
- User says `trace`, `why did this happen`, `root cause analysis`
- Ambiguous causal question: runtime bugs, regressions, performance issues
- Post-mortem or pre-mortem analysis
- "Given this output, trace back the likely causes"

## When NOT to Use

- Cause is known — just fix it
- User wants to fix, not understand — use `/analyze` (which proposes a fix)
- Feature planning — use `/spec` or `/deep-interview`

## Core Contract

Always maintain:
1. **Observation** — what was actually observed
2. **Hypotheses** — competing explanations (3 minimum)
3. **Evidence For** — what supports each
4. **Evidence Against / Gaps** — what contradicts or is missing
5. **Current Best Explanation** — the leader right now
6. **Critical Unknown** — the missing fact keeping top hypotheses apart
7. **Discriminating Probe** — the highest-value next step

## Workflow

### 1. Restate Observation

State precisely what was observed. No interpretation yet.

### 2. Generate 3 Hypotheses

Default lanes (unless the problem suggests better):
1. **Code-path / implementation cause** — bug in logic, race condition, wrong state
2. **Config / environment / orchestration cause** — wrong setting, version mismatch, infra
3. **Measurement / artifact / assumption mismatch** — wrong test, stale data, misleading metric

Each hypothesis must be distinct and falsifiable.

### 3. Parallel Investigation

Spawn 3 investigation agents in parallel, one per hypothesis lane. Each must:
- Own exactly one hypothesis
- Gather evidence **for** the lane
- Gather evidence **against** the lane
- Rank evidence strength (controlled reproduction > primary artifacts > inference > speculation)
- Name the **critical unknown** for the lane
- Recommend the best **discriminating probe**

### 4. Rebuttal Round

Before closing:
- Strongest non-leader presents best rebuttal to the current leader
- Leader must answer with evidence, not assertion
- If rebuttal weakens leader → re-rank
- If two hypotheses reduce to the same mechanism → merge explicitly

### 5. Synthesis

```
═══════════════════════════════
Trace — {YYYY-MM-DD}
═══════════════════════════════

Observation: {what was observed}

Ranked Hypotheses:
| Rank | Hypothesis | Confidence | Evidence Strength | Why it leads |
|------|------------|------------|-------------------|--------------|
| 1 | ... | High/Med/Low | Strong/Moderate/Weak | ... |
| 2 | ... | ... | ... | ... |
| 3 | ... | ... | ... | ... |

Evidence Summary:
  Hypothesis 1: {evidence for, evidence against}
  Hypothesis 2: ...
  Hypothesis 3: ...

Rebuttal Round:
  Best rebuttal to leader: ...
  Why leader held/failed: ...

Most Likely Explanation: {current best}
Confidence: {HIGH / MEDIUM / LOW}

Critical Unknown: {single missing fact}
Discriminating Probe: {single next step to collapse uncertainty}
```

## Evidence Strength Hierarchy

1. Controlled reproduction / direct experiment
2. Primary artifacts (logs, traces, configs, git blame, file:line)
3. Multiple independent sources converging
4. Single-source code-path inference
5. Circumstantial clues (timing, naming)
6. Intuition / analogy / speculation

## Mandatory Cross-Check Lenses

After initial evidence pass, apply when relevant:
- **Systems lens** — queues, retries, feedback loops, upstream/downstream dependencies
- **Premortem lens** — assume the best explanation is wrong; what failure mode would embarrass us?
- **Science lens** — controls, confounders, measurement bias

## Rules

- **Explain, don't fix.** Trace answers WHY, not HOW TO FIX.
- **Evidence over assertion.** Rank by evidence hierarchy.
- **Preserve uncertainty.** Don't fake certainty when evidence is incomplete.
- **Try to falsify the leader.** Every serious trace must challenge its own favorite.
- **Distinct hypotheses.** Don't run 3 flavors of the same idea.
