---
name: heartbeat
description: >
  On-demand project health assessment. Full-sweep diagnostic across schema, tests,
  security, observability, i18n, performance, and shipping readiness.
  Outputs tier-mapped specs to .tickets/ with full reconciliation.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent
user-invocable: true
---

When this skill is invoked, execute all steps in order — no questions, no preamble.

---

## Step 1 — Snapshot (silent, parallel)

Launch 3 Explore agents in parallel with `model: "sonnet"`. Each returns a structured list of findings. Do not output anything yet.

### Agent 1: Schema & Backend

Investigate `/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch/convex/`:

1. **Schema health** — Read `schema.ts`. Count tables, indexes. Check for missing indexes on foreign keys or common query paths. Flag tables with no indexes.
2. **3 non-negotiable invariants** — Verify implementation in mutation code:
   - No Exclusive-unit inventory held by more than one booking for overlapping sessions
   - Pooled inventory decrements on hold; blocks at zero
   - AvailabilitySnapshot updates in same mutation as Reservation write
3. **Mutation patterns** — Spot-check 5+ mutation files for: `requireAuth()` present, ownership checks, ConvexError codes consistent, all-or-nothing semantics.
4. **Code smells** — Count `as any`, `@ts-ignore`, `@ts-expect-error`, `console.log` in production code. Flag files >600 lines. Search for TODO/FIXME/HACK comments.
5. **Dependency direction** — Verify `convex/ ← lib/ ← components/ ← app/` has zero violations.

Return each finding as:
```
FINDING: {title}
TIER: {0-11}
SEVERITY: {blocker|gap|watch}
DETAILS: {what's wrong, which files, what should change}
```

### Agent 2: Tests & CI

Investigate `/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch/tests/` and `/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch/e2e/`:

1. **Test inventory** — Count test files (unit, behavioral, E2E). List files with no corresponding source coverage.
2. **Duplicate files** — Search for files matching `* 2.ts`, `* 2.tsx`, or any space-before-number pattern. Count them. These are sync artifacts that inflate coverage.
3. **Coverage gaps** — Compare mutations/queries in `convex/` against test files. Which mutations have zero test coverage?
4. **Test quality** — Spot-check 5+ test files for: hardcoded dates (should use `testDate()`), `as any` casts, weak assertions (`.toBeDefined()` alone), empty test blocks, `sleep()`/`setTimeout()`.
5. **CI/CD** — Check for `.github/workflows/` directory. Check `package.json` for coverage thresholds. Report if no automated test pipeline exists.
6. **Invariant coverage** — Are all 3 non-negotiable invariants explicitly tested (not just implicitly)?

Return each finding in the same format as Agent 1.

### Agent 3: Security, Observability, i18n, Performance, Shipping

Investigate the full project:

1. **Security** — Check for: rate limiting on endpoints, CSRF protection, input sanitization layer, `.env` secrets not committed, auth boundary enforcement (Clerk vs portal tokens).
2. **Agent config audit (AgentShield-style)** — Scan Claude Code configuration for security risks:
   - `~/.claude/settings.json` and project `.claude/settings*.json`: overly broad `allow` lists (bare `Bash` without path restrictions), missing `deny` entries, hardcoded secrets/tokens in MCP server `env` blocks (should be env var references like `$VAR`, not literal values)
   - `CLAUDE.md` files (global + project): hardcoded secrets, auto-run shell instructions that could be injected
   - `.claude/skills/` and `.claude/commands/`: unrestricted `allowed-tools` in frontmatter (e.g., bare `Bash` with no scope), user-controlled variables passed directly to shell commands
   - MCP server configs: hardcoded API keys, unknown/unvetted servers, overly broad tool permissions
   - Rate findings: hardcoded secret in config = Tier 2 blocker. Overly broad permissions = Tier 9 gap. Unvetted MCP server = Tier 2 gap.
3. **Observability** — Check for: Sentry/error tracking, structured logging, health check endpoints, analytics, alerting.
4. **i18n** — Count locale files in `messages/`. Check for hardcoded English strings in components. Check `src/i18n/request.ts` for hardcoded locale.
5. **Performance** — Check for: bundle analyzer config, N+1 query patterns, unbounded fetches, image optimization (next/image usage), caching headers.
6. **Shipping readiness** — Scan `.tickets/DD-*.md` files. Count open vs done tickets by priority. Identify blockers. Check for deployment docs, API docs.
7. **Git health** — Run `git log --oneline -20`, `git shortlog -sn --all`. Report commit velocity and contributor count.

Return each finding in the same format as Agent 1.

---

## Step 2 — Tier Classification (silent)

Collect all findings from the 3 agents. Deduplicate (same file + same issue = one finding). Assign each to a tier:

| Finding category | Default tier |
|---|---|
| Happy-path blocker | Tier 0 |
| Test infrastructure | Tier 1 |
| Security / data integrity | Tier 2 |
| Production hardening (Sentry, CI/CD, sanitization) | Tier 3 |
| Core UX / feature gap | Tier 4 |
| Test hardening (assertion quality, coverage gaps) | Tier 5 |
| Architecture (module splits, dependency direction) | Tier 6 |
| Frontend polish (a11y, CSS, loading states) | Tier 7 |
| Performance / scale (N+1, indexes, bundle) | Tier 8 |
| Process (hooks, workflows, skills) | Tier 9 |
| Backlog (nice-to-have, low risk) | Tier 10 |
| Post-launch features | Tier 11 |

Only findings rated `blocker` or `gap` become specs. `watch` findings are noted in the output but don't create TODO items.

---

## Step 3 — Ticket Reconciliation

Scan `.tickets/DD-*.md` files (excluding `.tickets/done/`).

### 3a. Mark resolved tickets

For each open ticket (status != `done`):
- Check if the heartbeat scan confirms it's resolved (code exists, test passes, feature works)
- If resolved → update the ticket's `status:` to `done`, set `updated:` to today, move the file to `.tickets/done/`

### 3b. Flag contradictions

If a finding contradicts an existing ticket (e.g., the ticket says "missing" but the code exists, or the ticket references deleted files), append a note to the ticket body:
```
⚠️ Heartbeat {date}: {contradiction description}
```

### 3c. Add new findings as tickets

For each `blocker` or `gap` finding NOT already covered by an existing ticket:

1. Read `.tickets/.counter`, increment, write back
2. Create `.tickets/DD-{NNN}.md` with YAML frontmatter and spec body:

```markdown
---
id: DD-{NNN}
title: "{Title}"
priority: {P0|P1|P2|P3}
status: ready
category: {slug}
blocked_by: []
assigned_to: null
branch: null
pr: null
side_effects: [{areas this finding touches beyond its primary scope}]
human_required: {true|false}
size: {S|M|L}
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
---

**Spec:** {What to change, which files, expected outcome.}
**Acceptance:**
- {Specific testable criterion}
- {Another criterion}
- `npm test` passes
**Blocked by:** {DD-NNN prerequisites, or "None".}
```

**Status defaults to `ready`** since heartbeat always writes full specs. If for some reason a ticket lacks spec text or acceptance bullets, downgrade to `backlog`.

### 3c. Field classification

When creating tickets, classify the new fields:

**`side_effects`:** List modules/areas the fix touches beyond the primary file:
- If the fix modifies a shared utility (`src/lib/`, `convex/lib/`) → include the util name
- If the fix changes a state machine or mutation → include "booking state machine" or similar
- If the fix changes test fixtures or seed helpers → include "seed fixtures"
- If isolated to a single file with no shared exports → `[]`

**`human_required`:** Set to `true` if:
- The finding is in an area with no existing spec and needs design input
- The fix requires domain knowledge (dive course rules, business logic) that isn't documented
- The finding flags a contradiction that needs a human decision
- Otherwise → `false`

**`size`:** Estimate from scope:
- `S` — single file fix, <30 min (assertion strengthening, type annotation, lint fix)
- `M` — 2-5 files, 30min-2hr (new test file, refactor a module, add a mutation)
- `L` — 5+ files or architectural, 2hr+ (new feature, state machine change, schema migration)

### 3d. Deduplication check

Before adding any ticket, search `.tickets/DD-*.md` for:
- Same file path referenced
- Same issue description (fuzzy match)
- Same slug/category

If a match is found, skip the finding. Note in output: "Skipped: already tracked as DD-{NNN}." Collect all skipped ticket IDs and include them in the Step 4 output under the "New tickets added" section as: `Skipped (already tracked): DD-{NNN}, DD-{NNN}, ...`

---

## Step 4 — Output

Print exactly this format:

```
Heartbeat — {YYYY-MM-DD}
────────────────────────
Dimensions: schema · tests · security · observability · i18n · performance · shipping · git

Resolved (marked done):
  #{N} {title}
  ...
  {or "None"}

New tickets added:
  DD-{NNN}: {title} (P{N})
  DD-{NNN}: {title} (P{N})
  ...
  {or "None — codebase is clean"}

Contradictions flagged:
  #{N}: {brief description}
  ...
  {or "None"}

Watch items (no spec, just awareness):
  {title} — {one-line note}
  ...

Tickets: .tickets/
```

---

## Rules

- **Execute immediately.** No preamble, no methodology explanation.
- **Parallel agents in Step 1.** Launch all 3 in a single message. Minimize tool rounds.
- **Never duplicate a ticket.** Search `.tickets/` before adding. If it exists, skip.
- **Map to priorities, not severity labels.** The priority system IS the severity system.
- **Specs must be actionable.** File paths, function names, acceptance criteria. Not "fix the bug."
- **The 3 invariants are always checked.** Every heartbeat verifies them explicitly. Non-negotiable.
- **Full reconciliation.** Mark done + add new + flag contradictions. Don't just append.
- **DiveDispatch-specific.** Tickets: `.tickets/DD-*.md`. Schema: `convex/schema.ts`. Invariants: per CLAUDE.md.
- **`watch` items don't create tickets.** They appear in output only — awareness, not action.
- **This skill is independent.** Not part of the vault lifecycle. Can run at any time.
