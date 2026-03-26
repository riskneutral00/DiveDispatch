---
name: spec
description: "Write a feature spec via structured interview. Enforces data-first thinking, TDD test plan, universality across roles, supersession, and risk checks. Output goes to TODO.md for /first to pick up."
user-invocable: true
---

# /spec — Spec Builder

You are writing a feature spec for DiveDispatch. Conduct a structured interview — one question at a time, with a recommended answer, a second option, and free-form. Between answers, silently run lesson checks and codebase research. Only surface a flag if a check fails.

**Do not skip questions. Do not batch questions. One at a time.**

---

## Phase 1: Understand the feature

Before asking anything, read the user's description carefully. Then search in parallel:
- `convex/schema.ts` — relevant tables
- `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md` — related or overlapping items
- `src/components/` and `src/lib/constants/` — existing shared components and configs

Use this research to make informed recommendations in every question.

---

## Phase 2: Interview (7 questions)

### Q1: Classify

Ask: "What kind of change is this?"

Options:
- **New pattern** — creates new component, page, or flow (recommend if nothing similar exists in codebase)
- **Extension** — adds behavior to an existing component or page

**Silent check:** If the feature is cross-cutting (touches language matching, course catalog, session builder, or another foundational concern), search TODO.md for an item that covers that concern. If none exists, flag: "This depends on [X] which doesn't have its own spec yet. Should we write that first?"

### Q2: Data model

Ask: "What data does this need?"

Present what you found in `convex/schema.ts` — relevant tables, fields, indexes. Recommend one of:
- "Looks like `[table]` already has `[fields]`, so we'd add `[X]`"
- "This needs a new query/mutation: `[name]`"
- "No schema changes — this is purely UI"

**If the user describes UI interactions** ("when I click this...", "there should be a button that..."), gently redirect: "Got it — let me map that to the data model first, then we'll spec the UI." Do not proceed to UI details until the data model is settled.

**Silent check (UI-First Without Guardrails):** Is the data model thought through before UI? If not, keep asking data questions.

### Q2.5: Test plan

Ask: "What should the tests verify?"

Based on the data model answer, recommend test types using CLAUDE.md's test type selection rules (cheapest test that catches the bug):

| Data model change | Test type | Template |
|---|---|---|
| Schema change (new table/field) | Integration (convex-test) | `seedUser`, relevant seed helpers, assert data written correctly |
| New mutation | Behavioral | Assert the outcome (what changed), not the implementation |
| New pure function (validation, calculation) | Unit | Direct import, `testDate()`, edge cases |
| New component calling useMutation | Component + Contract | Component renders correctly, contract test verifies data transformation |
| State machine change | Hardening | Every valid transition tested, every invalid rejected |

Present a recommended test plan:
```
Test plan:
- Unit: tests/{module}.test.ts — {function} returns {expected} when {input}
- Integration: tests/{feature}.test.ts — {mutation} creates {outcome}
- Component: tests/components/{component}.test.tsx — renders {state}, calls {mutation}
```

The user can adjust. The test plan goes into the final spec output.

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

**If multiple roles:** Search the codebase for existing shared components and config files that already serve this pattern. Surface what you find.

**Silent check (Specs Must Enforce Universality):** If Affected Roles > 1, the spec MUST name the ONE component and reference the config file driving role-specific behavior.

### Q4: Dependencies & platform

Ask: "Anything this depends on?"

Present what you found in TODO.md — items this depends on or conflicts with.

Check platform features:
- **Clerk**: auth, user management, roles, webhooks — don't rebuild these
- **Convex**: real-time queries, mutations, file storage, cron jobs — use native features
- **Resend**: email — use the MCP integration

**Silent check (Don't rebuild what the platform gives you).**

### Q5: Risk assessment

Assess based on everything learned so far. Ask only if there are flags to raise:

- **Novel interaction** → "Recommend building a throwaway prototype first."
- **High domain complexity** → "This needs real dive course knowledge."
- **Shared component collision** → "Another TODO also touches [component]."
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

Present overlapping items from TODO.md. Recommend:
- "This supersedes #[N]. Files to delete: [list]." or
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

---

## Phase 5: Write to TODO.md

Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md`. Find the appropriate tier for this feature. Assign the next number.

Append the new item to the tier table, then write the spec block below it:

```markdown
| {N} | **{Title}** — {one-line description} | §{slug} |
**Spec:** {What to change, which files, what the outcome looks like.}
**Acceptance:** {Specific, testable bullets. Include "npm test passes".}
**Test plan:**
- {Type}: `{file}` — {what it tests}
- {Type}: `{file}` — {what it tests}
**Blocked by:** {#N prerequisite items, or "None".}
**Side effects:** {Modules/areas touched beyond primary scope, or "None".}
**Human required:** No — spec interview completed.
**Size:** {S|M|L}
```

### Tier selection

| Tier | Use when |
|---|---|
| Tier 3 (Prod Hardening) | Error handling, monitoring, CI/CD |
| Tier 4 (Core UX) | Features users need before launch |
| Tier 7 (Frontend Polish) | Visual quality, a11y, performance |
| Tier 8 (Performance) | Scale, N+1, indexes |
| Tier 11 (Post-Launch) | Deferred features |

---

## Phase 6: Confirm

1. Report: "Added #{N} to Tier {X}: {title}"
2. Walk through before → after from the user's perspective — what does each affected role see/do today vs. after this is built?
3. Note: "/first will pick this up next session as the next work item (if it's the highest-priority unchecked item)."

---

## Rules

- **One question at a time.** Never batch.
- **Data before UI.** Always.
- **Tests before code.** The test plan is mandatory, not optional.
- **TODO.md is the output.** Not a standalone file. /first reads it, /last updates it.
- **Cheapest test wins.** Don't spec a component test for something a unit test catches.
- **Edge cases over happy paths.** The test plan should focus on what could go wrong.
