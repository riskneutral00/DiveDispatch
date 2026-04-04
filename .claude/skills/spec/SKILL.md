---
name: spec
description: "Write feature specs via structured interview. Deep codebase exploration, multi-ticket decomposition, executable acceptance criteria. Output goes to .tickets/DD-*.md — consumed by /post-spec."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent
user-invocable: true
---

# /spec — Universal Ticket Originator

You are writing feature specs for DiveDispatch. Conduct a structured interview — one question at a time, with a recommended answer, a second option, and free-form. Between answers, silently run lesson checks and codebase research. Only surface a flag if a check fails.

**Do not skip questions. Do not batch questions. One at a time.**

The tickets you produce must contain ALL information an agent needs to implement the work — file:line references, executable acceptance criteria, QA scenarios. Workers should never need to re-explore the codebase. `/post-spec` consumes these tickets directly.

---

## Entry Modes

- **`/spec {description}`** — Standard: explore for new feature, opportunistically fill overlapping pre-specs
- **`/spec fill`** — Batch fill: no new feature, scan all `needs_spec: true` tickets, cluster by area, one deep exploration per cluster, fill them all
- **`/spec DD-{NNN}`** — Single fill: explore and fill one specific ticket

---

## Phase 0: Deep Exploration (before any questions)

After reading the user's description, launch Explore agents to build a **context map** — a structured list of `file:line` references, each with a one-line description AND the relevant code snippet (3-10 lines). Capture function signatures, prop types, return types, and key logic — the parts a worker needs to start coding without re-reading the file. This map powers every recommendation and populates ticket `**References:**` sections.

**Scaling by scope:**
- Narrow/specific change → 1 Explore agent (relevant area only)
- Broad feature or cross-cutting concern → up to 3 agents in parallel:

```
Agent 1 (convex/): mutations, queries, schema tables, validators → file:line map
Agent 2 (src/): components, hooks, utilities, pages → file:line map
Agent 3 (tests/): existing coverage, fixtures, test patterns → coverage map
```

Use `model: "sonnet"` for all Explore agents.

Merge results into a single context map. Do NOT show the raw map to the user — use it to make informed, specific recommendations in every question.

### Touches Prediction

Using the context map, predict which files and directories this ticket will CREATE or MODIFY (not just read). Write these as a `touches` array in frontmatter. This enables `/post-spec` to detect cross-ticket file conflicts and sequence execution correctly.

Rules:
- Use directory-level paths for broad changes (e.g., `convex/bookings/`)
- Use exact file paths for targeted changes (e.g., `convex/schema.ts`)
- Always include test files that will be created or modified
- Include `convex/schema.ts` if any schema change is needed
- Be conservative — over-predict rather than under-predict
- Shared utilities (`convex/lib/`, `src/lib/`) count as touches if modified
- Do NOT include files that are only read as references

Examples:
- Backend mutation + test: `["convex/bookings/create.ts", "tests/bookings/create.test.ts"]`
- Schema change + fullstack: `["convex/schema.ts", "convex/equipment/", "src/components/equipment/", "tests/equipment/"]`
- Frontend-only: `["src/components/profile/", "tests/components/profile.test.tsx"]`

Also search in parallel (same as before):
- `convex/schema.ts` — relevant tables
- `.tickets/DD-*.md` — related or overlapping tickets (YAML frontmatter: status, priority, side_effects)
- `src/components/` and `src/lib/constants/` — existing shared components and configs

### Pre-Spec Scanning

After building the context map, scan `.tickets/DD-*.md` for tickets with `needs_spec: true` in frontmatter. For each pre-spec found, check if its `**Problem:**` description or `area` field overlaps with the context map (mentions same tables, same feature area, same components).

If overlapping pre-specs exist, present them:

```
Found {N} pre-specs that overlap with this exploration:
  DD-{A}: "{title}" — touches {overlapping area}
  DD-{B}: "{title}" — touches {overlapping area}

Fill these in now? (Free — context already loaded)
  A) Yes, fill in all (Recommended)
  B) Pick specific ones
  C) Skip
```

### Pre-Spec Merge Detection

After building the context map, predict which files each pre-spec would modify (same logic as Touches Prediction). If two or more pre-specs share predicted affected files, recommend merging:

```
These pre-specs overlap on affected files:
  DD-{A} + DD-{B}: both modify {shared files}

Recommend combining into one ticket to prevent cross-ticket file conflicts.
  A) Merge (Recommended — one ticket, reassess size)
  B) Keep separate (will need wave sequencing to avoid conflicts)
```

If merged:
- Combine `**Problem:**` sections (preserve both verbatim, labeled by original ticket ID)
- Union the `**Deferred:**` questions
- Reassess `size` based on combined scope (two S tickets sharing files → likely M)
- Reassess `recommended_model` (combined M/L → may need opus)
- Delete the absorbed ticket file, keep the lower-numbered ID

If kept separate:
- Put in different waves and auto-populate `blocked_by` so they execute sequentially

For accepted pre-specs, after the main spec interview is complete:
1. Read the pre-spec's `**Deferred:**` section for unanswered questions
2. Re-ask each deferred question (Matt can defer again → set `human_required: true`)
3. Using the context map, fill in: `**References:**`, `**QA Scenarios:**`, executable `**Acceptance:**`, `**Test plan:**`
4. Set: `area` (from code analysis), `wave`, `recommended_model`
5. Remove `needs_spec: true` from frontmatter
6. If no deferred questions remain: set `status: ready`
7. If deferred questions remain and Matt deferred again: set `human_required: true`, keep `status: backlog`

---

## Phase 0-B: Batch Fill Mode (`/spec fill`)

When invoked as `/spec fill` (no feature description), skip Phase 1-2 interview for a new feature. Instead:

1. Scan all `.tickets/DD-*.md` with `needs_spec: true` in frontmatter
2. If none found → report "No pre-specs to fill" → exit
3. Present list to Matt:
   ```
   Found {N} pre-specs:
     DD-{A}: "{title}" ({area})
     DD-{B}: "{title}" ({area})
     DD-{C}: "{title}" ({area})

   Fill all, pick specific ones, or filter by area?
   ```
4. Cluster selected tickets by `area` field overlap (same area → same cluster, overlapping `side_effects` → same cluster)
5. **Merge detection:** Within each cluster, predict which files each ticket would modify based on `**Problem:**` + `**Pre-spec notes:**` domain descriptions matched against the codebase area. If tickets share predicted files, recommend merging (same format as Pre-Spec Merge Detection above). If merged: combine problems, union deferred questions, reassess size/model, delete absorbed ticket file. If kept separate: sequence into different waves, set `blocked_by`.
6. Per cluster: build ONE context map using Explore agents (up to 3, model: sonnet) — scope exploration to the areas referenced by the cluster's tickets
7. Per ticket in cluster:
   - Read `**Deferred:**` section for unanswered questions
   - Re-ask each deferred question **one at a time** (Matt can defer again → `human_required: true`)
   - Using the context map, fill in: `**Spec:**`, `**References:**`, `**Acceptance:**`, `**Test plan:**`, `**QA Scenarios:**`, `touches`
   - Set: `area` (from code analysis), `wave`, `recommended_model`
   - Remove `needs_spec: true` from frontmatter
   - If no deferred questions remain: set `status: ready`
   - If deferred questions remain and Matt deferred again: set `human_required: true`, keep `status: backlog`
8. Context map is shared across all tickets in the cluster — never re-explore for the same area
9. After all tickets filled, show summary table (same format as Phase 6 multi-ticket)

Then proceed to Phase 5 (write) and Phase 6 (confirm) as normal.

---

## Phase 1: Understand the feature

Use the context map to present what you found — cite specific `file:line` locations.

---

## Phase 2: Interview

### Q1: Classify

Ask: "What kind of change is this?"

Options:
- **New pattern** — creates new component, page, or flow (recommend if nothing similar exists in codebase)
- **Extension** — adds behavior to an existing component or page

**Silent check:** If the feature is cross-cutting (touches language matching, course catalog, session builder, or another foundational concern), search `.tickets/` for an item that covers that concern. If none exists, flag: "This depends on [X] which doesn't have its own spec yet. Should we write that first?"

### Q1.5: Decomposition (NEW)

Based on the context map, assess whether the work is a single ticket or multiple.

Ask: "Based on what I explored, this breaks into N pieces: [list with file:line evidence]. Should I spec each as a separate ticket, or bundle?"

Present each piece with:
- What it changes (with file references)
- Size estimate (S/M/L)
- Whether it depends on another piece

If **single ticket**: proceed to Q2 as normal.

If **multi-ticket**: assign wave numbers:
- Independent pieces → same wave (can run in parallel)
- Dependent pieces → later wave (sequenced). Auto-populate `blocked_by` from wave ordering.
- Same-wave tickets MUST have non-overlapping `touches` arrays. If two pieces modify the same files, put them in different waves.

Then interview each ticket in sequence through Q2-Q6, using the shared context map. Label each sub-interview: `"Ticket 1 of N: {title}"`

### Q2: Data model

Ask: "What data does this need?"

Present what you found in `convex/schema.ts` — relevant tables, fields, indexes. **Cite file:line.** Recommend one of:
- "Looks like `{table}` already has `{fields}` at `schema.ts:{line}`, so we'd add `{X}`"
- "This needs a new query/mutation: `{name}` (similar to `{existing}` at `{file}:{line}`)"
- "No schema changes — this is purely UI"

**If the user describes UI interactions** ("when I click this...", "there should be a button that..."), gently redirect: "Got it — let me map that to the data model first, then we'll spec the UI." Do not proceed to UI details until the data model is settled.

**Silent violation detection:** Check the context map for:

| Violation | Detection | Action |
|---|---|---|
| Core → Adapter import direction | Change requires importing from `convex/bookings/` (Core) into an adapter | Flag: "This would violate dependency direction. Recommend moving shared logic to `convex/lib/`." |
| IMMUTABLE file modification | Change touches `scripts/**`, `.claude/agents/**`, `.claude/hooks/**`, `.claude/settings.json` | Flag: "Requires interactive implementation — will set `human_required: true`." |
| Booking invariant risk | Change modifies reservation/availability/snapshot logic | Flag which of the 3 invariants is at risk, add to `side_effects` |
| Missing index | New query pattern on a field without an index | Flag: "Needs index on `{table}.{field}` — adding to schema change." |

Raise violations inline during the question — don't batch them.

### Q2.5: Test plan + QA scenarios

Ask: "What should the tests verify?"

Based on the data model answer, recommend test types (cheapest test that catches the bug):

| Data model change | Test type | Template |
|---|---|---|
| Schema change (new table/field) | Integration (convex-test) | `seedUser`, relevant seed helpers, assert data written correctly |
| New mutation | Behavioral | Assert the outcome (what changed), not the implementation |
| New pure function (validation, calculation) | Unit | Direct import, `testDate()`, edge cases |
| New component calling useMutation | Component + Contract | Component renders correctly, contract test verifies data transformation |
| State machine change | Hardening | Every valid transition tested, every invalid rejected |

Present a recommended test plan with **executable acceptance criteria**:
```
Test plan:
- Unit: `tests/{module}.test.ts` — `npx vitest run tests/{module}.test.ts -- --grep "{function}"`
- Integration: `tests/{feature}.test.ts` — `npx vitest run tests/{feature}.test.ts`
```

Then present **QA Scenarios** (at least 2, mandatory):
```
QA Scenarios:
1. {exact function/API call with specific inputs} → {exact expected output/state}
2. {exact function/API call with specific inputs} → {exact expected output/state}
```

QA scenarios must be agent-executable — specific enough that Patrol can verify them post-merge against a live deployment. No vague descriptions.

### Q3: Universality

Ask: "Which roles does this affect?"

Present the full role list grouped by type:
- **Organizers:** dive-center, agent, liveaboard, dive-resort, dive-hostel, dive-site
- **Resources:** instructor, dive-master, boat, equipment, pool, compressor

Recommend based on feature type:
- Dashboard feature → likely all roles
- Booking creation → organizers only
- Request handling → resources only
- Profile feature → check which role types have the relevant profile fields

**If multiple roles:** Search the codebase for existing shared components and config files that already serve this pattern. Surface what you find with file:line references.

**Silent check (Specs Must Enforce Universality):** If Affected Roles > 1, the spec MUST name the ONE component and reference the config file driving role-specific behavior.

### Q4: Dependencies & platform

Ask: "Anything this depends on?"

Present what you found in `.tickets/` — tickets this depends on or conflicts with.

Check platform features:
- **Clerk**: auth, user management, roles, webhooks — don't rebuild these
- **Convex**: real-time queries, mutations, file storage, cron jobs — use native features
- **Resend**: email — use the MCP integration

**Silent check (Don't rebuild what the platform gives you).**

### Q5: Risk assessment

Assess based on everything learned so far. Ask only if there are flags to raise:

- **Novel interaction** → "Recommend building a throwaway prototype first."
- **High domain complexity** → "This needs real dive course knowledge."
- **Shared component collision** → "Another ticket also touches [component] at [file:line]."
- **Batch operations** → "Spec needs batched mutations (Convex limits)."

**Always ask:** "What shared modules or areas does this touch beyond its own scope?"

Map answers to the `side_effects` field. Common areas:
- Shared validation utils (`src/lib/`)
- Booking state machine (`convex/bookings/`)
- Auth boundary (`convex/lib/auth.ts`, `src/proxy.ts`)
- Seed fixtures (`tests/helpers/`)
- Design system (`design-system/`)

If no flags: Say "No risk flags" and move on.

### Q6: Supersession

Ask: "Does this replace anything existing?"

Present overlapping tickets from `.tickets/`. Recommend:
- "This supersedes DD-{N}. Files to delete: [list]." or
- "No overlap found."

---

## Phase 3: Vault enrichment

Before writing, search the full vault for relevant content:
- `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Architecture/Lessons.md` — mistakes to avoid
- `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Architecture/Architecture.md` — architectural decisions
- `~/Desktop/RiskNeutral/Vaults/DiveDispatch/PatternLibrary/` — reusable patterns

Add anything relevant to Implementation Notes.

---

## Phase 4: Validation checklist (run silently)

Before writing, verify each check passes. If any fail, raise it with the user.

| # | Check | If fails |
|---|---|---|
| 1 | Vision settled for this area? | "Writing this spec now risks churn." |
| 2 | Data model before UI? | Redirect to Q2 |
| 3 | Test plan defined? | Redirect to Q2.5 |
| 4 | Cross-cutting concerns have their own specs? | "Should we spec [X] first?" |
| 5 | Platform feature checked? | "Clerk/Convex already handles [X]" |
| 6 | Multi-role → ONE component named? | Name the shared component and config |
| 7 | Existing components referenced, not duplicated? | "Extend [component], don't create new" |
| 8 | No violations flagged unresolved? | Revisit the violation from Q2 |
| 9 | QA scenarios are executable? | Rewrite with specific inputs/outputs |

---

## Phase 5: Write to .tickets/

`.tickets/` is the single source of truth for all work items. Read `.tickets/.counter` for the next ticket number. For multi-ticket specs, increment the counter once per ticket.

Create `.tickets/DD-{NNN}.md` with enriched YAML frontmatter + spec body:

```markdown
---
id: DD-{NNN}
title: "{Title}"
status: ready
priority: {P0|P1|P2|P3}
category: {feature|bugfix|security|performance|tooling|ux}
area: {backend|frontend|schema|testing|fullstack}
assigned_to: null
branch: null
blocked_by: [{DD-NNN dependencies, or empty}]
blocks: [{DD-NNN tickets this blocks, or empty}]
pr: null
side_effects: [{areas from Q5, or empty}]
touches: [{predicted modified files/dirs from Phase 0 Touches Prediction}]
human_required: false
size: {S|M|L}
wave: {1|2|3}
recommended_model: {sonnet|opus}
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
---

**Spec:** {What to change, which files, what the outcome looks like.}

**References:**
- `{file:line-range}` — {what it is and why it's relevant}
  ```tsx
  {3-10 lines of the relevant code: signatures, types, key logic}
  ```
- `{file:line-range}` — {what it is and why it's relevant}
  ```tsx
  {3-10 lines of the relevant code: signatures, types, key logic}
  ```

**Acceptance:**
- [ ] `{executable command}` (e.g., `npx vitest run tests/file.test.ts -- --grep "case"`)
- [ ] `npx tsc --noEmit` (no new TS errors)
- [ ] {specific, testable condition}

**Test plan:**
- {Type}: `{file}` — {what it tests}
- {Type}: `{file}` — {what it tests}

**QA Scenarios:**
1. {exact input/action} → {exact expected output/state}
2. {exact input/action} → {exact expected output/state}

**Do Not Touch:** {files/areas explicitly out of scope, if any}
```

### Field Selection Guide

**`area`** (technical domain — drives worker context routing):

| Area | When |
|---|---|
| `backend` | Primarily convex/ mutations, queries, validators |
| `frontend` | Primarily src/ components, hooks, pages |
| `schema` | Schema changes, index additions, migrations |
| `testing` | Test-only changes, fixture updates |
| `fullstack` | Mixed convex/ + src/ changes |

**`wave`** (parallelization group):
- `1` = can start immediately (no dependencies within this spec session)
- `2` = depends on at least one wave-1 ticket
- `3` = depends on at least one wave-2 ticket
- Single-ticket specs always default to `wave: 1`

**`recommended_model`:**
- `sonnet` = default for S and M tickets
- `opus` = for L tickets, security-category tickets, or tickets touching Core (booking state machine)

**Priority:**

| Priority | Use when |
|---|---|
| P0 | Blocks launch, data corruption, security vulnerability |
| P1 | Core UX, production hardening, error handling |
| P2 | Polish, a11y, performance, post-launch features |
| P3 | Nice-to-have, deferred, low-impact |

**Category** (change type):

| Category | Use when |
|---|---|
| `feature` | New capability or flow |
| `bugfix` | Fixing broken behavior |
| `security` | Auth, ownership, PII exposure |
| `performance` | N+1, indexes, bundle size |
| `tooling` | Skills, hooks, CI/CD, dev experience |
| `ux` | Visual polish, a11y, responsive |

After writing each ticket file, update `.tickets/.counter` with the highest number used.

---

## Phase 6: Confirm + Estimate

### Single ticket:
1. Report: "Created DD-{NNN}: {title} (P{X}, {category}, {area})"
2. Walk through before → after from the user's perspective
3. Note: `human_required: true` → needs Matt's input before `/post-spec` can execute; `false` → auto-pickup

### Multi-ticket:
1. Summary table with batch time estimation:

```
Created {N} tickets from "{topic}":
  Wave 1: DD-{A} ({size}, {area}) + DD-{B} ({size}, {area})
  Wave 2: DD-{C} ({size}, {area}, blocked by DD-{A})
```

2. Walk through wave ordering and why
3. Note `/post-spec` pickup for the batch

### NotebookLM Ingest

After confirming, write a spec session document:

```
~/Desktop/RiskNeutral/Vaults/DiveDispatch/Specs/{YYYY-MM-DD}-{slug}.md
```

Contents:
```markdown
# Spec Session: {topic}
**Date:** {YYYY-MM-DD}
**Tickets:** {DD-A, DD-B, DD-C}

## Context Map Summary
{Top 10-15 file:line references from exploration, grouped by area}

## Decisions
{Key decisions made during interview — data model choices, role scoping, risk mitigations}

## Violations Detected
{Any violations flagged during Q2-Q5, and how they were resolved}

## Vault References Used
{Lessons, patterns, or architecture docs that informed the spec}
```

This is ingested into NotebookLM on the next `/vault` run. Future `/spec` sessions can query past decisions.

---

## Rules

- **One question at a time.** Never batch.
- **Data before UI.** Always.
- **Tests before code.** The test plan is mandatory, not optional.
- **`.tickets/` is the output.** `/board` manages lifecycle, `/board sync` mirrors to vault TODO.md.
- **Cheapest test wins.** Don't spec a component test for something a unit test catches.
- **Edge cases over happy paths.** The test plan should focus on what could go wrong.
- **References mandatory for M/L.** Every M/L ticket must have at least one `file:line` reference with an embedded code snippet. S tickets can omit if trivially scoped. Snippets must include function signatures, prop types, and return types — enough context to code without re-reading the file.
- **QA scenarios mandatory.** At least 2 per ticket. Must be agent-executable (specific inputs → specific outputs).
- **Violations caught here, not at execution time.** Flag dependency direction, IMMUTABLE files, invariant risk, missing indexes during the interview.
- **One exploration, many tickets.** The context map from Phase 0 is shared across all tickets in a multi-ticket session. Never re-explore for the same topic.
- **Wave ordering at confirmation.** Always show wave ordering and dependency reasoning for multi-ticket specs.
