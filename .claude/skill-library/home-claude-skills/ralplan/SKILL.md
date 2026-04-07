---
name: ralplan
description: "Consensus planning with Planner → Architect → Critic deliberation loop. Gates vague execution requests. Max 5 iterations to consensus."
allowed-tools: Read, Write, Bash, Grep, Glob, Agent, AskUserQuestion
user-invocable: true
---

# /ralplan — Consensus Planning

Multi-perspective planning: Planner creates plan, Architect reviews for soundness, Critic validates quality. Loop until consensus or 5 iterations.

**Execute immediately. No preamble.**

## When to Use

- User says `ralplan`, `consensus plan`, `plan with review`
- User wants a plan validated by multiple perspectives before execution
- Complex task where a bad plan would waste significant execution cycles
- Pre-step before `/autopilot` or `/ralph` for high-stakes work

## When NOT to Use

- Simple task that doesn't need planning — just do it
- User already has a plan — use `/ralph` or `/autopilot`
- User wants to explore, not plan — use plan mode

## Pre-Execution Gate

When execution skills (`/ralph`, `/autopilot`) receive vague prompts (no file paths, function names, issue numbers, or acceptance criteria), they should redirect here first.

**Passes gate** (specific enough for direct execution):
- `ralph fix the null check in src/hooks/bridge.ts:326`
- `autopilot implement ticket DD-142`

**Gated** (needs scoping first):
- `ralph fix this`
- `autopilot build the app`
- `ralph add authentication`

## Workflow

### Step 1: Planner Creates Plan

Spawn planning agent (`model: "opus"`):
- Analyze the task/spec
- Break into implementation steps with file references
- Identify acceptance criteria
- Produce RALPLAN-DR summary:
  - **Principles** (3-5 guiding decisions)
  - **Decision Drivers** (top 3 constraints)
  - **Viable Options** (≥2) with bounded pros/cons
  - If only one viable option: explicit invalidation rationale for alternatives

### Step 2: Architect Reviews

Spawn architect agent (`model: "opus"`) — **MUST complete before Step 3**:
- Review for architectural soundness
- Provide strongest steelman antithesis (argue against the plan)
- Identify at least one real tradeoff tension
- Attempt synthesis where possible

### Step 3: Critic Validates

Spawn critic agent (`model: "opus"`) — **ONLY after Step 2 completes**:
- Enforce principle-option consistency
- Check for fair alternatives consideration
- Verify risk mitigation clarity
- Confirm testable acceptance criteria
- Confirm concrete verification steps
- Verdict: `APPROVE`, `ITERATE`, or `REJECT`

### Step 4: Re-review Loop (max 5 iterations)

On `ITERATE` or `REJECT`:
1. Collect Architect + Critic feedback
2. Revise plan with Planner
3. Return to Architect review
4. Return to Critic evaluation
5. Repeat until `APPROVE` or 5 iterations

### Step 5: Output

On approval, output the final plan with:
- Implementation steps with file references
- Acceptance criteria
- RALPLAN-DR summary
- ADR (Decision, Drivers, Alternatives, Why chosen, Consequences)

Present execution options:
1. **`/ralph`** (Recommended for sequential work)
2. **`/autopilot`** (for full autonomous pipeline)
3. **Request changes** (continue planning)

## Rules

- **Sequential review**: Architect MUST complete before Critic starts
- **Max 5 iterations**: Present best version if no consensus
- **Never implement**: This is a planning skill, not execution
- **Evidence-based critique**: Architect and Critic must cite specific concerns, not vague "could be better"
