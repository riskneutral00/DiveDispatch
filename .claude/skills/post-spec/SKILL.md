---
name: post-spec
description: "Autonomous ticket execution. Picks ready tickets, TDDs them, spawns independent review, commits per ticket, vaults. Resume-aware."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, Skill
user-invocable: true
model: opus
---

# /post-spec — Autonomous Ticket Execution Pipeline

You are executing all ready tickets in a single session. No prompts, no checkpoints — Matt walks away and comes back to committed, reviewed code.

**Invocation:**
- `/post-spec` — execute all `ready` tickets
- `/post-spec DD-469 DD-470` — execute specific tickets only

**Working directory:** `.post-spec/` (gitignored)

---

## Phase 0: Baseline

1. **Resume check:** If `.post-spec/plan.md` exists, enter Resume Mode (see below)
2. Create `.post-spec/` directory if it doesn't exist
3. Tag current commit: `git tag post-spec-baseline-$(date +%Y%m%d-%H%M%S)`
4. Write tag name to `.post-spec/baseline-tag`
5. Snapshot test state: `npx vitest run --reporter=json 2>/dev/null | tail -1 > .post-spec/test-baseline.json`
6. Read all `ready` tickets from `.tickets/` (or filter to specified IDs)
7. If no ready tickets → report "No ready tickets" → exit

---

## Phase 1: Plan

Build a detailed execution plan. This is the critical phase — the plan quality determines everything.

### 1a: Explore

Launch Explore agents (up to 3, `model: "sonnet"`) to build a cross-ticket context map:
- All files referenced in ticket `touches` arrays
- All files referenced in `**References:**` sections
- Shared utilities and types imported by touched files
- Test fixtures and patterns for touched areas

### 1b: Analyze

For all tickets together:
1. **Dependency graph:** Which tickets block which? Do any share modified files?
2. **Execution order:** Respect `blocked_by`, then priority (P0 first), then size (S before L)
3. **Conflict detection:** If two tickets modify the same file, sequence them (never parallel)
4. **Side effect map:** What shared modules does each ticket touch?

### 1c: Write Plan

Write `.post-spec/plan.md`:

```markdown
# Post-Spec Execution Plan
**Created:** {timestamp}
**Baseline tag:** {tag name}
**Tickets:** {count}

## Execution Order

### 1. DD-{NNN}: {title} [{size}]
**Status:** pending
**Files to modify:**
- `{file}` — {what changes}
- `{file}` — {what changes}
**Tests to write:**
- `{test file}` — {what it tests}
**Depends on:** none
**Risk notes:** {any cross-ticket concerns}

### 2. DD-{NNN}: {title} [{size}]
**Status:** pending
...

## Cross-Ticket Concerns
- {shared file X modified by tickets A and B — B must run after A}
- {type change in ticket A affects import in ticket C}
```

---

## Phase 2: Execute

For each ticket in plan order:

### 2a: Pick
1. Update plan: set ticket status to `executing`
2. Set ticket to `in_progress` on board (move file, update frontmatter)

### 2b: Implement (TDD)
1. Read the ticket spec, references, and the plan's file-change details
2. **Write failing tests first** — define expected behavior
3. Implement the changes per plan
4. Run `npx vitest run` — iterate until green
5. Run `npx tsc --noEmit --pretty 2>&1 | head -30` — fix any type errors in changed files

### 2c: Self-Check
Before committing, verify against quality rules:
- No `as any`, `as unknown`, or unsafe casts
- No `console.log` in production code
- No commented-out code or dead imports
- No weak assertions (`.toBeDefined()` alone)
- No framework-testing tests (testing JS/Convex work, not business logic)
- Tests assert specific changed values, not just existence
- Tests would fail if implementation reverted
- `useMemo`/`useCallback` deps are referentially stable
- No conditional renders causing layout shift on non-overlay elements
- Seed fixtures used (not raw `ctx.db.insert`)
- `testDate(N)` for dates (not hardcoded strings)

### 2d: Commit
1. Stage specific files: `git add {files}` (never `git add -A`)
2. Commit: `feat(DD-NNN): {title}` or `fix(DD-NNN): {title}`
3. At most 1 commit per ticket (implementation + tests together)

### 2e: Advance
1. Mark ticket `done` — move to `.tickets/done/`
2. Update plan: set ticket status to `done`
3. If more tickets remain, continue to next

### Cumulative Gate (after every 3rd ticket)
Run cumulative checks to catch cross-ticket breakage:
- `npx tsc --noEmit --pretty 2>&1 | head -30`
- `npx vitest run`
If failures: diagnose whether the current ticket or an interaction caused it. Fix and amend the last commit.

---

## Phase 3: Independent Review

After ALL tickets are executed and committed:

1. Get the diff: `git diff $(cat .post-spec/baseline-tag)..HEAD`
2. **Spawn a separate review agent** (`model: "sonnet"`) with ONLY the diff and the list of changed files. The review agent:
   - Runs `/gate` (quality gate skill)
   - Checks for: type safety, test gaps, invariant violations, layout stability
   - Returns findings as CRITICAL / HIGH / MEDIUM / LOW
3. **CRITICAL findings:** Fix immediately, commit as `fix: address review findings`
4. **HIGH findings:** Log to `.post-spec/review-findings.md`, do not block
5. **MEDIUM/LOW:** Log only

The review agent did NOT write the code — it has fresh context and no self-review bias.

---

## Phase 4: Close

1. **Board sync:** Run `Skill("board", "sync")`
2. **Test delta:** Compare test count now vs `.post-spec/test-baseline.json`
3. **Vault observations:** Write session file to `~/Desktop/RiskNeutral/Vaults/DiveDispatch/raw/Sessions/{date}.md`:
   - Tickets completed
   - Test delta (before/after)
   - Review findings summary
   - Cross-ticket lessons learned
4. **Summary output:**
   ```
   /post-spec complete.
   Tickets: {N} executed, {M} review findings ({C} critical, {H} high)
   Tests: {before} → {after} (+{delta})
   Baseline tag: {tag} (git reset --hard {tag} to rollback)
   ```
5. Clean up `.post-spec/` working files (keep `plan.md` and `review-findings.md` for inspection)

---

## Resume Mode

When `.post-spec/plan.md` exists on startup:

1. Read the plan file
2. Check which tickets are marked `done` vs `pending`/`executing`
3. If a ticket is `executing` (crashed mid-implementation):
   - Check for uncommitted changes: `git status --porcelain`
   - If dirty: `git checkout .` (discard incomplete work)
   - Reset ticket to `pending` in plan
4. Resume execution from the first non-`done` ticket
5. Skip Phase 0 and Phase 1 entirely (plan already exists)

To force a fresh run: delete `.post-spec/plan.md` before invoking.

---

## Rollback

All rollback is manual (Matt decides):
- **Single ticket:** `git revert <commit-hash>` + move ticket from `done/` back to `.tickets/` with `status: ready`
- **Full batch:** `git reset --hard $(cat .post-spec/baseline-tag)` + move all tickets back
- **View baseline:** `cat .post-spec/baseline-tag`

---

## Rules

1. **No prompts.** Never use AskUserQuestion. Never pause for confirmation. Execute fully.
2. **Commit per ticket.** Each ticket gets exactly one commit. Never batch multiple tickets into one commit.
3. **TDD mandatory.** Write failing tests before implementation. No exceptions.
4. **Sequential only.** No worktrees, no parallel execution. One ticket at a time, in plan order.
5. **Independent review.** Phase 3 review MUST be a spawned agent, not self-review.
6. **Resume-aware.** Always check for existing plan on startup.
7. **IMMUTABLE files.** Never modify: `scripts/**`, `.claude/agents/**`, `.claude/hooks/**`, `.claude/settings.json`, `.claude/settings.local.json`. If a ticket requires it, skip that ticket with a note.
8. **Stage specific files.** Never `git add -A`. Never commit `.env`, credentials, or large binaries.
9. **Conventional commits.** `feat(DD-NNN):` or `fix(DD-NNN):` or `test(DD-NNN):`.
10. **Cheapest test wins.** Unit > behavioral > integration > E2E.
11. **No over-engineering.** Implement exactly what the spec says. No bonus features, no speculative abstractions.
12. **Plan is law.** Phase 2 follows the Phase 1 plan. If the plan is wrong, fix the plan file first, then implement.
