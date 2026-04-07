---
name: ralph
description: "PRD-driven persistence loop. Keeps working until ALL acceptance criteria pass with verified evidence. The boulder never stops."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, Skill
user-invocable: true
---

# /ralph — Persistent Completion Loop

Ralph wraps any task with a structured PRD, iterates story-by-story until all acceptance criteria pass, requires reviewer verification, and runs a mandatory cleanup pass before completion.

**The boulder never stops.**

## When to Use

- Task requires guaranteed completion with verification (not "do your best")
- User says `ralph`, `don't stop`, `must complete`, `finish this`, `keep going until done`
- Work may span multiple iterations and needs persistence across retries
- Task benefits from structured acceptance criteria with reviewer sign-off

## When NOT to Use

- User wants a full autonomous pipeline from idea to code — use `/autopilot`
- User wants to explore or plan before committing — use plan mode
- Quick one-shot fix — just do it directly
- User wants manual control over completion

## Args

| Flag | Behavior |
|------|----------|
| *(none)* | Standard PRD mode |
| `--no-prd` | Skip PRD generation, work in legacy mode (no story tracking) |
| `--no-deslop` | Skip the mandatory post-review cleanup pass |

## Workflow

### 1. PRD Setup (first iteration only)

Create `.ralph/prd.json` in the project directory:

```json
{
  "stories": [
    {
      "id": "US-001",
      "title": "Story title",
      "acceptanceCriteria": [
        "Specific, testable criterion 1",
        "Specific, testable criterion 2"
      ],
      "passes": false,
      "priority": 1
    }
  ]
}
```

**CRITICAL: Refine acceptance criteria.** Generic criteria like "Implementation is complete" are worthless. Every criterion must be:
- Specific: names a function, file, behavior, or output
- Testable: can be verified with a command or test
- Unambiguous: pass/fail is binary, not subjective

### 2. Pick Next Story

Read `.ralph/prd.json`. Select highest-priority story with `passes: false`.

### 3. Implement

Delegate to specialist agents at appropriate tiers:
- Simple lookups/reads: `model: "haiku"`
- Standard implementation: `model: "sonnet"`
- Complex analysis/architecture: `model: "opus"`

Fire independent tasks in parallel. Use `run_in_background: true` for builds, tests, installs.

If sub-tasks are discovered during implementation, add them as new stories to `prd.json`.

### 4. Verify Story

For EACH acceptance criterion:
- Run the verification command
- Read the actual output
- Evidence must be fresh (< 5 minutes old)
- If ANY criterion is NOT met → continue working, do NOT mark complete

**Reject vague completion signals:**
- "I think it works" → NOT ACCEPTED. Run the test.
- "Should be fine" → NOT ACCEPTED. Show the output.
- "Probably fixed" → NOT ACCEPTED. Prove it.

### 5. Mark Story Complete

When ALL criteria are verified:
- Set `passes: true` in `.ralph/prd.json`
- Record progress in `.ralph/progress.txt`: what was implemented, files changed, learnings

### 6. Check PRD Completion

- ALL stories `passes: true`? → Proceed to verification (Step 7)
- NOT all complete? → Loop back to Step 2

### 7. Reviewer Verification

Spawn a verification agent:
- <5 files, <100 lines with full tests: `model: "sonnet"`
- Standard changes: `model: "sonnet"`
- >20 files or security/architectural changes: `model: "opus"`

The reviewer verifies against SPECIFIC acceptance criteria from prd.json, not vague "is it done?"

### 7.5. Mandatory Cleanup Pass

Unless `--no-deslop` was specified:
- Run `/ai-slop-cleaner` on files changed during this Ralph session only
- Keep scope bounded to changed files — do not broaden
- If cleanup introduces issues, fix within the same scope

### 7.6. Regression Re-verification

After cleanup:
- Re-run all relevant tests: `npx vitest run`
- Re-run type check: `npx tsc --noEmit`
- If regression fails → roll back cleanup or fix, then re-verify
- Only proceed after post-cleanup regression passes

### 8. Completion

Report:

```
═══════════════════════════════
Ralph Complete — {YYYY-MM-DD}
═══════════════════════════════

Stories completed: {N}/{N}
Files changed: {list}
Tests: {pass count} passing
Reviewer: APPROVED
Cleanup: {COMPLETED | SKIPPED}
Regression: PASSING
```

Clean up: `rm -rf .ralph/`

### 9. On Rejection

Fix the issues raised by the reviewer. Re-verify with same reviewer. Loop.

## Escalation & Stop Conditions

- **Blocker requiring user input**: Stop and report (missing credentials, unclear requirements, external service down)
- **Same issue recurs 3+ iterations**: Report as potential fundamental problem
- **User says "stop", "cancel", "abort"**: Stop, preserve state for resume

## Car Integration

When Ralph runs inside the Car workflow (invoked by Driver):
- Write completion events to `.car/merged/` on success
- Write blocking events to `.car/reviewed/` on rejection
- Heartbeat via existing Car mechanism

## Final Checklist

- [ ] All prd.json stories have `passes: true`
- [ ] Acceptance criteria are task-specific (not generic)
- [ ] Zero pending TODO items
- [ ] Fresh test output shows all pass
- [ ] Fresh build output shows success
- [ ] Reviewer verification passed against specific criteria
- [ ] Cleanup pass completed (or `--no-deslop`)
- [ ] Post-cleanup regression passes
- [ ] `.ralph/` directory cleaned up
