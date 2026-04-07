---
name: autopilot
description: "Full autonomous 6-phase pipeline: expand idea → plan → execute → QA cycle → validate → cleanup. Hands-off execution from description to working code."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, Skill
user-invocable: true
---

# /autopilot — Autonomous Execution Pipeline

Takes a brief description and autonomously handles the full lifecycle: requirements analysis, planning, parallel implementation, QA cycling, multi-perspective validation, and cleanup.

**Execute immediately. No preamble.**

## When to Use

- User wants end-to-end autonomous execution from idea to working code
- User says `autopilot`, `autonomous`, `build me`, `create me`, `full auto`, `handle it all`
- Task requires multiple phases: planning, coding, testing, validation
- Non-ticket work: refactors, migrations, spikes, new features

## When NOT to Use

- Ticket-scoped work — use `/driver` (Car workflow)
- User wants to explore options — use plan mode
- Quick fix or single change — just do it or use `/ralph`
- User says "just explain" or "what would you suggest"

## Args

| Flag | Behavior |
|------|----------|
| *(none)* | Full 6-phase pipeline |
| `--skip-qa` | Skip Phase 3 (QA cycling) |
| `--skip-validation` | Skip Phase 4 (multi-perspective review) |

## Phases

### Phase 0: Expansion

Turn the user's idea into a detailed spec.

- **If input is vague** (no file paths, function names, or concrete anchors): Offer redirect to `/deep-interview` for Socratic clarification
- **Otherwise**: Analyze requirements and create technical specification

Spawn an analysis agent (`model: "opus"`) to extract:
- Goal statement
- Constraints and non-goals
- Acceptance criteria (testable)
- Technical approach

Output: `.autopilot/spec.md`

### Phase 1: Planning

Create an implementation plan from the spec.

Spawn a planning agent (`model: "opus"`):
- Break into implementable steps
- Identify file ownership per step
- Order by dependency
- Flag shared files (potential conflicts)

Output: `.autopilot/plan.md`

### Phase 2: Execution

Implement the plan using Ralph persistence:

- Simple tasks → `model: "haiku"`
- Standard tasks → `model: "sonnet"`
- Complex tasks → `model: "opus"`
- Run independent tasks in parallel
- Use `run_in_background: true` for builds/tests

### Phase 3: QA Cycling (UltraQA)

Cycle until all tests pass (max 5 iterations):

1. Run build: `npx tsc --noEmit`
2. Run tests: `npx vitest run`
3. Run lint (if configured)
4. If failures → diagnose → fix → repeat
5. Stop early if same error repeats 3 times (fundamental issue)

### Phase 4: Validation

Multi-perspective review in parallel:

1. **Architecture review**: Does the implementation match the spec? Any structural issues?
2. **Security review**: OWASP top 10, auth checks, input validation
3. **Code quality review**: Readability, maintainability, DD patterns

All reviewers must approve. Fix and re-validate on rejection.

### Phase 5: Cleanup

- Run `/ai-slop-cleaner` on changed files
- Re-run regression tests after cleanup
- Remove `.autopilot/` state directory
- Report completion summary

## Completion Report

```
═══════════════════════════════
Autopilot Complete — {YYYY-MM-DD}
═══════════════════════════════

Phases: 0-5 completed
Spec: {goal summary}
Files changed: {N}
Tests: {N} passing
QA cycles: {N}/5
Validation: ALL APPROVED
Cleanup: COMPLETED

What was built:
  - {bullet summary of deliverables}
```

## Escalation & Stop Conditions

- **Same QA error 3 cycles**: Stop and report fundamental issue
- **Validation keeps failing after 3 rounds**: Stop and report
- **Vague input detected**: Offer redirect to `/deep-interview`
- **User says "stop", "cancel"**: Stop, preserve state

## Rules

- Each phase must complete before the next begins
- Parallel execution within phases where possible
- Never self-approve — use separate reviewer agents
- Evidence required before claiming completion
- Clean up state files on success
