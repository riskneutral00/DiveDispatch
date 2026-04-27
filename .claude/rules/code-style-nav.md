---
description: Code style rules and codebase navigation patterns
---

## No AnyCtx
Never use `AnyCtx`, `GenericCtx`, or any `any` wrapper for Convex context. Use `QueryCtx` for reads, `MutationCtx` for writes, `DbCtx` for shared helpers. Never introduce `as any` to silence Convex type errors — fix the underlying type.

## Schema-driven interviews
Read the schema before asking seed data or entity questions. Ask about every required field. The schema is the source of truth for what questions need to be asked.

## Skeleton first
Read `.SKELETON.md` before launching broad Explore agents or grep sweeps. Follow its Reference Docs pointers instead of searching blind.

## No comments
Do not add comments to code. No inline comments (`//`), no block comments (`/* */`), no JSDoc, no TODO comments, no section dividers.
The codebase is AI-generated and AI-maintained — the code is the documentation.

**Functional comment exceptions** (these are required by other hooks/invariant files — do NOT remove them):
- `{/* design-ok */}` — suppresses design token enforcement for intentional exceptions
- `{/* comments-ok */}` — general escape hatch
- `// batch-exempt: <reason>` — required by `n-plus-one-guard.sh` to suppress false positives on sequential DB operations
- `// fsm-ok` — required by `fsm-status-guard.sh` to mark intentional direct status patches in gateway files
- `// snapshot: <description>` — required by `schema-invariants.md` Rule 5 to annotate denormalized fields
- `// bounded: <reason>` — required by `query-invariants.md` Rule 1 to document why a `.collect()` is safe
- `// spacing-ok: <reason>` — required by `spacing-ladder-guard.sh` to suppress off-ladder spacing values (`px-2.5`, `gap-2.5`, `gap-5`) when the visual is intentional
- `// query-budget-ok: <reason>` — required by `screen-query-budget.sh` to document a non-provider component that legitimately exceeds the 3-subscription cap (or to grandfather a known offender pending its planned aggregation migration)

## Stay in scope

Every changed line in your diff must trace to a specific element of the user's stated ask. Before each Edit/Write, run the trace check:

*For each line I am about to add or modify, what element of the user's request requires this change?* If you can't name the element, drop the line.

### Three concrete failure modes

1. **Cosmetic relocation.** Moving `// batch-exempt: <reason>` between leading-line and trailing-same-line. Hook accepts both placements; the move serves no user-request element. Drop. Same for moving `fsm-ok`, `snapshot:`, `bounded:`, `spacing-ok:`, `query-budget-ok:` — placement disagreements with the canonical column below are not yours to resolve in this diff.
2. **Out-of-ask rename.** Renaming `profileMine` → `personProfileMine` because a sibling concept now exists. Defensible as its own task. Not defensible bundled into a turn that didn't ask for it. Drop and log to `.observations`.
3. **Refactor blast radius.** Migrating a callsite to a new helper signature when the old shape was what the callsite wanted. The signature change itself may be in-scope; propagating it to N untouched callsites usually is not. See the wrapper-vs-break checklist below.

### When edits in these classes ARE in scope

- The user's turn explicitly named the change ("rename `profile*` to `personProfile*`," "fix the lying comment on line 47," "migrate every caller to the new helper").
- The change is the natural consequence of the asked work (you wrote new sequential `await ctx.db.…`, so you must add `// batch-exempt: …` for the hook).
- The change is removing dead code that your edit orphans (the orphaned import, the now-unused helper). Removing it is part of the asked deletion, not a separate cosmetic act.

Outside those, defer.

### Deferred-observations log

When you notice something legitimate but out of scope, append a line to `.observations` at repo root:

```
2026-04-26T14:02 - convex/profileHelpers.ts - profileMine could be personProfileMine after entityProfilesByUser landed (sibling disambiguation)
```

`.observations` is gitignored, session-local. Surface the entries at end-of-turn so Matt can decide whether to act on any of them. If he says yes, that becomes its own scoped turn — clean signal, not bundled drift.

### Wrapper-vs-break checklist (refactor blast radius)

When the user's ask requires changing a helper's signature, return shape, or name, run this checklist before writing the diff:

| Check | If yes | If no |
|---|---|---|
| Does the new shape provide capability the old shape couldn't? | Continue. | Don't change the shape; just rename or extend in place. |
| Do most existing callsites need the new capability? | Propagating to those callsites is in-scope. | Default to wrapper: keep the old name as `(...) => new(...)[0]` (or equivalent). Only callsites that need the new capability migrate. |
| Did the user ask for a breaking change? (e.g., "I want every caller forced to handle multiple rows") | The break is the feature; propagate. | Don't propagate. |
| Is the old shape encoding a buggy assumption (silently drops data, hides multi-row reality, etc.)? | Break is correctness; propagate and note in commit message. | Wrap. |

A callsite that ends up doing `newHelper(...)[0]` is the signal you should have written a wrapper.

### Functional-marker placement (canonical reference)

Each marker's real placement contract is whatever its consuming hook reads:

| Marker | Hook scan | Place new markers as |
|---|---|---|
| `// batch-exempt: <reason>` | Same-line on the awaited DB call (`n-plus-one-guard.sh`) | Trailing same-line |
| `// fsm-ok` / `// fsm-ok: <reason>` | Same-line on the patch (`fsm-status-guard.sh`) | Trailing same-line |
| `// spacing-ok: <reason>` | Same-line containing the off-ladder value (`spacing-ladder-guard.sh`) | Trailing same-line |
| `// bounded: <reason>` | Same-line on `.collect()` OR previous line (`unbounded-query-guard.sh`) | Trailing on `.collect()`; leading-line OK when annotating a multi-line loop or guard block |
| `// snapshot: <description>` | No hook — convention only | Trailing on the field definition in `convex/schema.ts` |
| `// query-budget-ok: <reason>` | File-wide grep (`screen-query-budget.sh`) | Leading-line standalone above the export |
| `{/* design-ok: <reason> */}` / `// design-ok: <reason>` | Same-line containing the offender (`design-token-enforcement.sh`) | Either form; preserve whatever placement already exists |
| `// comments-ok` | Whole-file or whole-line strip (`no-comments-guard.sh`) | Either; preserve whatever placement already exists |

When a marker already exists, **do not relocate it**, even if its placement disagrees with the "Place new markers as" column. Relocation without a substantive change on the same line is cosmetic-only and blocked by `cosmetic-edit-blocker.sh`.
