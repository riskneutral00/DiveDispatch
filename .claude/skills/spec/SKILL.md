---
description: "Write an Overstory spec via structured interview. Enforces data-first thinking, universality across roles, supersession, and risk checks — all derived from Lessons.md. TRIGGER when: user describes a new feature, says 'make a ticket', 'write a ticket', 'new ticket', 'spec this', 'add a feature', or describes UI/behavior that should go through the spec workflow instead of direct implementation."
user-invocable: true
---

# /spec — Spec Builder

You are writing an Overstory spec for DiveDispatch. Conduct a structured interview — one question at a time, with a recommended answer, a second option, and free-form. Between answers, silently run lesson checks and codebase research. Only surface a flag if a check fails.

**Do not skip questions. Do not batch questions. One at a time.**

---

## Phase 1: Understand the feature

Before asking anything, read the user's description carefully. Then search in parallel:
- `convex/schema.ts` — relevant tables
- `.overstory/specs/` — related or overlapping specs
- `src/components/` and `src/lib/constants/` — existing shared components and configs

Use this research to make informed recommendations in every question.

---

## Phase 2: Interview (6 questions)

### Q1: Classify

Ask: "What kind of change is this?"

Options:
- **New pattern** — creates new component, page, or flow (recommend if nothing similar exists in codebase)
- **Extension** — adds behavior to an existing component or page

**Silent check:** If the feature is cross-cutting (touches language matching, course catalog, session builder, or another foundational concern), search `.overstory/specs/` for a spec that covers that concern. If none exists, flag: "This depends on [X] which doesn't have its own spec yet. Should we write that first?"

### Q2: Data model

Ask: "What data does this need?"

Present what you found in `convex/schema.ts` — relevant tables, fields, indexes. Recommend one of:
- "Looks like `[table]` already has `[fields]`, so we'd add `[X]`"
- "This needs a new query/mutation: `[name]`"
- "No schema changes — this is purely UI"

**If the user describes UI interactions** ("when I click this...", "there should be a button that..."), gently redirect: "Got it — let me map that to the data model first, then we'll spec the UI." Do not proceed to UI details until the data model is settled.

**Silent check (UI-First Without Guardrails):** Is the data model thought through before UI? If not, keep asking data questions.

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

**If multiple roles:** Search the codebase for existing shared components and config files that already serve this pattern. Surface what you find: "Found `BookingCalendar` already serves all roles via `dashboard-config.ts`. This should extend that pattern — not create a new component."

**Silent check (Specs Must Enforce Universality):** If Affected Roles > 1, the spec MUST:
1. Name the ONE component (not one per role)
2. Reference the config file driving role-specific behavior
3. List every role explicitly

If the user says "build the agent [X]" for something that should apply to all roles, flag it: "Should this be one shared component that all [organizer/resource] roles use, configured per role? That's how the dashboard and calendar work."

### Q4: Dependencies & platform

Ask: "Anything this depends on?"

Present what you found in `.overstory/specs/`:
- Specs this clearly depends on
- Specs that overlap or conflict

Check platform features:
- **Clerk**: auth, user management, roles, webhooks — don't rebuild these
- **Convex**: real-time queries, mutations, file storage, cron jobs — use native features
- **Resend**: email — use the MCP integration

Recommend: "This depends on [spec ID]" or "No dependencies found."

**Silent check (Don't rebuild what the platform gives you):** If the feature duplicates something Clerk/Convex provides natively, flag it.

### Q5: Risk assessment

Assess based on everything learned so far. Ask only if there are flags to raise:

- **Novel interaction** (no reference in codebase or prototype) → "This has no reference implementation. Recommend building a throwaway prototype first to prove the interaction works."
- **High domain complexity** (dive course rules, certification requirements) → "This needs real dive course knowledge. Want to walk through the rules before I spec it?"
- **Shared component collision** (another spec also modifies this component) → "L5-[XX] also touches [component]. These can't run in parallel — I'll add a concurrency lock."
- **Batch operations** → "This could touch >1,000 rows. Spec needs to mandate batched mutations via actions (4,096 read / 8,192 write limit)."

If no flags: Say "No risk flags" and move on. Do not ask a question if there's nothing to flag.

### Q6: Supersession

Ask: "Does this replace anything existing?"

Present overlapping specs you found in Phase 1. Recommend:
- "This supersedes [spec ID]. We should list [files] for deletion." or
- "No overlap found."

**Silent check (Specs Must Enforce Universality):** If superseding, the spec must explicitly list every file to delete. Don't leave orphans.

---

## Phase 3: Vault enrichment

Before writing, search the full vault for relevant content:
- `~/Desktop/DiveVault/Inspirations/` — design references
- `~/Desktop/DiveVault/PatternLibrary/` — reusable patterns
- `~/Desktop/DiveVault/DiveDispatch/Lessons.md` — mistakes to avoid
- `~/Desktop/DiveVault/DiveDispatch/Architecture.md` — architectural decisions
- `~/Desktop/DiveVault/Sessions/` — recent session context

Add anything relevant to Implementation Notes.

---

## Phase 4: Validation checklist (run silently)

Before writing the spec, verify each check passes. If any fail, raise it with the user before proceeding.

| # | Check | If fails |
|---|---|---|
| 1 | Vision settled for this area? | "We haven't mapped the full user journey for [X] yet. Writing this spec now risks churn." |
| 2 | Data model before UI? | Redirect to Q2 |
| 3 | Cross-cutting concerns have their own specs? | "This depends on [X] — should we spec that first?" |
| 4 | Platform feature checked? | "Clerk/Convex already handles [X]" |
| 5 | Widget earns its spot? | "Does this help the user make a decision, or is it just data?" |
| 6 | Multi-role → ONE component named? | "The spec needs to name the shared component and config" |
| 7 | Existing components referenced, not duplicated? | "Found [component] — extend it, don't create a new one" |
| 8 | Batch ops within Convex limits? | "Add batching pattern to Implementation Notes" |
| 9 | DESIGN_SYSTEM.md referenced? | Add reference to UI/Design section |

---

## Phase 5: Write the spec

Use this template. Every field is required unless marked optional.

```markdown
# <TIER>-<NN>: <title>

## Description
[What + why — 2-4 sentences]

## Domain Knowledge Reference
[Section of docs/DOMAIN_KNOWLEDGE.md, or "N/A"]

## Affected Roles
[`all` | explicit list | `role-agnostic`]

## Shared Component
[Required if Affected Roles has more than one role]
[Name the ONE component + reference the config file]
[Use "N/A" if single-role or role-agnostic]

## Data Model
[Schema changes | new queries/mutations | state transitions | "No changes"]

## File Scope
[Exhaustive list of files to create or modify]

## Dependencies
[Spec IDs, or "None"]

## Supersedes
[Spec IDs this replaces + files to delete, or "None"]

## Concurrency Lock
[Required if modifying a shared component — spec IDs that must not run in parallel]
[Use "None" if no conflicts]

## Acceptance Criteria
- [Specific, testable bullets]
- npm test passes

## Complexity
[Low | Medium | High]

## Risk Flags
[Optional: novel pattern, domain expertise needed, batch operation, prototype recommended]

## Implementation Notes
[Edge cases, vault observations, transaction order, etc.]

## UI / Design
[Reference DESIGN_SYSTEM.md. Layout constraints before visual treatment.]
```

### Spec naming

Check the highest existing number in `.overstory/specs/` for the target tier, then increment.

| Tier | Use when |
|---|---|
| L5 | New post-v1 features (default) |
| POST | Deferred / not scheduled yet |

File name: `<TIER>-<NN>-<kebab-slug>.md`

---

## Phase 6: Parallel Safety Check

Run this immediately after writing the spec file. Do not prompt the user — execute silently and report results.

1. **Collect open specs.** Read all `L*-*.md` files in `.overstory/specs/`. Cross-reference `.seeds/issues.jsonl` — a spec is "open" if it has a non-closed issue entry OR no entry yet (newly written specs count as open).

2. **Parse File Scope.** For each open spec (including the one just written), extract backtick-wrapped file paths from `## File Scope`. Normalize: strip any leading `./`.

3. **Compare file sets.** For each file in the new spec's File Scope, check if it appears in any other open spec's File Scope.

4. **Classify each overlap.** For every overlapping file, read both specs' File Scope descriptions and determine:
   - **Same file, different concerns** (e.g., `schema.ts` but different tables; `dashboard-config.ts` but different role sections) → add the other spec's ID to the new spec's `## Concurrency Lock`
   - **Same file, same logic** (e.g., both modify the same function in `_shared.ts`, both alter the same table definition) → add to both `## Dependencies` AND `## Concurrency Lock` on the new spec

5. **Auto-update the new spec only.** Edit the just-written spec's `## Concurrency Lock` and `## Dependencies` fields. Do NOT auto-edit other specs — output a suggestion instead:
   > "Suggestion: Consider adding `<new-spec-id>` to `## Concurrency Lock` in `<other-spec-file>`."

6. **Report to user:**
   - If overlaps found: "Parallel safety: `<new-spec-id>` overlaps with `<other-spec-id>` on [`file1`, `file2`]. Added concurrency lock: [`<ids>`]."
   - If no overlaps: "Parallel safety: no file overlaps with open specs."

---

### After writing

1. Write the file to `.overstory/specs/<filename>`
2. Confirm: "Spec written: `<TIER>-<NN>-<slug>` — [one-line summary]"
3. If the spec supersedes others, remind: "Remember to archive [spec IDs] before the next Overstory run."
4. **Close the loop with Matt:** Summarize how this changes the current app experience. Walk through the before → after from the user's perspective: what does each affected role see/do today vs. after this spec is built? Keep it concrete — reference specific screens, interactions, and flows. This is the final gut-check that the spec matches Matt's intent.
