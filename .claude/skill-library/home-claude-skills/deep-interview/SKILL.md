---
name: deep-interview
description: "Socratic requirements interview with mathematical ambiguity scoring. Asks one question at a time targeting the weakest clarity dimension. Gate: ambiguity must drop below 20% before proceeding."
allowed-tools: Read, Bash, Grep, Glob, Agent, AskUserQuestion
user-invocable: true
---

# /deep-interview — Socratic Requirements Clarification

Ask targeted Socratic questions that expose hidden assumptions. Score ambiguity mathematically. Refuse to proceed until clarity threshold is met.

**One question at a time. Never batch.**

## When to Use

- User has a vague idea and wants thorough requirements before execution
- User says `deep interview`, `interview me`, `don't assume`, `make sure you understand`
- Task is complex enough that jumping to code would waste cycles
- Pre-step before `/spec` for ambiguous feature requests

## When NOT to Use

- User has specific request with file paths and function names — execute directly
- User says "just do it" or "skip the questions"
- User already has a PRD or spec — use `/ralph` or `/autopilot`

## Workflow

### Phase 1: Initialize

1. Parse the user's idea
2. Detect **brownfield vs greenfield**:
   - Spawn Explore agent (haiku): check if cwd has existing source code
   - Source files + user references modifying something → brownfield
   - Otherwise → greenfield
3. For brownfield: Explore codebase first. **Never ask the user what the code already tells you.**
4. Announce:
   > Starting deep interview. I'll ask targeted questions to clarify your idea. After each answer, I'll show your clarity score. We proceed once ambiguity drops below 20%.
   >
   > **Your idea:** "{idea}"
   > **Project type:** {brownfield|greenfield}
   > **Current ambiguity:** 100%

### Phase 2: Interview Loop

Repeat until ambiguity ≤ 20% OR user exits early:

#### 2a. Generate Question

Target the dimension with the LOWEST clarity score:

| Dimension | Weight (greenfield) | Weight (brownfield) | Question Style |
|-----------|-------------------|-------------------|---------------|
| Goal Clarity | 40% | 35% | "What exactly happens when...?" |
| Constraint Clarity | 30% | 25% | "What are the boundaries?" |
| Success Criteria | 30% | 25% | "How do we know it works?" |
| Context Clarity | N/A | 15% | "How does this fit existing code?" |

**Question rules:**
- ONE question at a time
- Expose ASSUMPTIONS, not gather feature lists
- For brownfield: cite repo evidence before asking ("I found JWT auth in `src/auth/`. Should this extend that?")
- If scope is fuzzy (entities keep shifting): ask ontology-style questions ("What IS the core thing here?")

#### 2b. Ask via AskUserQuestion

```
Round {n} | Targeting: {weakest_dimension} | Ambiguity: {score}%

{question}
```

#### 2c. Score Ambiguity

After each answer, score all dimensions 0.0-1.0:

- **Goal Clarity**: Is the primary objective unambiguous?
- **Constraint Clarity**: Are boundaries and non-goals clear?
- **Success Criteria**: Could you write a test that verifies success?
- **Context Clarity** (brownfield): Do we understand the existing system?

Calculate: `ambiguity = 1 - weighted_sum(dimension_scores)`

#### 2d. Report Progress

```
| Dimension | Score | Gap |
|-----------|-------|-----|
| Goal | {s} | {gap or "Clear"} |
| Constraints | {s} | {gap or "Clear"} |
| Criteria | {s} | {gap or "Clear"} |
| **Ambiguity** | **{score}%** | |
```

### Phase 3: Challenge Agents

At round thresholds, shift perspective:

- **Round 4+: Contrarian** — "What if the opposite were true?" Challenge core assumptions.
- **Round 6+: Simplifier** — "What's the simplest version?" Remove unnecessary complexity.
- **Round 8+ (if ambiguity > 30%): Ontologist** — "What IS this, really?" Find the essence.

Each mode used once, then return to normal Socratic questioning.

### Phase 4: Crystallize Spec

When ambiguity ≤ 20%:

Write spec to `.specs/deep-interview-{slug}.md`:
- Goal, Constraints, Non-Goals, Acceptance Criteria
- Assumptions Exposed & Resolved
- Technical Context (brownfield findings)
- Clarity Breakdown table
- Full interview transcript

### Phase 5: Execution Bridge

Present options:
1. **`/ralplan` → `/autopilot`** (Recommended) — consensus-refine spec, then execute
2. **`/autopilot`** — skip consensus, execute directly
3. **`/ralph`** — persistence loop on the spec
4. **`/spec`** — convert to DD ticket format
5. **Refine further** — continue interviewing

**MUST invoke chosen skill via Skill(). Never implement directly.**

## Soft Limits

- **Round 3+**: Allow early exit with warning if ambiguity > threshold
- **Round 10**: Soft warning — "10 rounds, ambiguity at {score}%. Continue?"
- **Round 20**: Hard cap — proceed with current clarity

## Rules

- **One question per round.** Batching causes shallow answers.
- **Explore before asking.** Never ask what the code reveals.
- **Score after every answer.** Transparency builds trust.
- **Respect early exit.** But show the risk clearly.
- **Never implement.** This is a requirements skill, not execution.
