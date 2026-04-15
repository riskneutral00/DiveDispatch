---
type: migration
purpose: Record what moved where and why during the skeleton reshape of 2026-04-14.
last_touched: 2026-04-14
---

# Migration Record — 2026-04-14

## Context

The happy-path skeleton grew to 1705 lines as a monolithic markdown. Audit methodology was schema-driven (using `convex/schema.ts` as the yardstick), which missed FE-surfaced and product-intent-driven fields. A runtime LLM would still have to scroll for specific values. Matt directed a reshape for: runtime-ready data access, machine-validatable drift protection, and a discoverable structure future LLMs can pick up without prompting.

## What moved

| Source (pre-reshape) | Destination | Notes |
|---|---|---|
| `happy-path-spec-skeleton.md` §7.12 canonical JSON block (~670 lines) | `ultraplan/canonical.json` | Verbatim extraction. Added `$schema` reference, dive_center_1 / dive_center_2 / customer_1-3 placeholders (with `_pending` markers), and `confinedCapable: true` on pools (previously silent). |
| n/a (new) | `ultraplan/canonical.schema.json` | Handwritten JSON Schema per product intent. NOT derived from `convex/schema.ts`. |
| `happy-path-spec-skeleton.md` §8 Acts partition (~100 lines) | `ultraplan/choreography.md` | Enriched. References canonical keys instead of inlining values. |
| `happy-path-spec-skeleton.md` §8 end-of-Act assertions (scattered) | `ultraplan/assertions.yaml` | Promoted to YAML keyed by `(act, phase)`. |
| n/a (new) | `ultraplan/INDEX.md` | Discovery entry point. Routing table + validation workflow + resume pointer. |
| `happy-path-spec-skeleton.md` (full 1705-line version) | `archive/skeleton-monolith-2026-04-14.md` | Preserved verbatim as reference. |

## What stayed in `skeleton.md`

- §0 Glossary + §0.5 Navigation
- §1 Purpose, §2 Testability Principle, §3 LAW Invariants, §4 Start/End, §5 Scope, §6 Authorities
- §7 Locked Context (§7.1–§7.11 frozen items + §7.12 shrunk to a pointer to canonical.json/.schema.json)
- §9 Prerequisites (P0 blockers)
- §10 Open Questions
- §11 Claude's Recommendations, §12 Tensions, §13 Anti-Patterns
- §14 Resume Point (audit process, per-stop discipline)
- §15 Execution Conventions
- §16 Meta (cadence, ownership, env, retirement)

Post-reshape skeleton target: ~400 lines. Pure meta / audit / governance / lessons.

## Lesson #1 amendment

**Was:** "Skeleton §7.12 + §9 are the ONLY canonical ledger."

**Now:** "The joint ledger is: `skeleton.md` + `canonical.json` + `canonical.schema.json` + `choreography.md` + `assertions.yaml`. Nothing in `.claude/plans/`. Nothing in `Vaults/DiveDispatch/wiki/Plans/`. See `INDEX.md` routing table for what belongs where."

## Why each split

- **Skeleton.md shrinks** — audit governance, not data.
- **canonical.json** — structured data, directly addressable by runtime (`canonical.stakeholders.compressor_1.users.firstName` resolves in one lookup).
- **canonical.schema.json** — drift protection. `ajv validate` catches any silent divergence between canonical values and intended shapes.
- **choreography.md** — play-by-play for runtime. References canonical keys; no value duplication.
- **assertions.yaml** — machine-readable expected state. Runtime diff against actual → mismatch routes to Observations.md per §15.

## Discovery additions

To ensure future LLMs find the artifact set:

1. `INDEX.md` is the entry point — routing table + resume pointer.
2. DiveDispatch `CLAUDE.md` updated with a one-line pointer to `ultraplan/INDEX.md`.
3. (Optional follow-up) Session-start hook can inject ultraplan status — not wired in this reshape; can add later if needed.

## Known follow-ups after this reshape

1. **Retroactive re-audit of Stops 1–6** against the three-way framing (schema ∪ FE ∪ intent). Previous audit used schema as the yardstick; may have missed FE-surfaced or intent-required fields. Surface fields silently omitted (e.g., `confinedCapable` on pools was missing, now added).
2. **Validate canonical.json against canonical.schema.json** — run `ajv validate` for the first time. Any failure = file a P0.
3. **Stop 7 DiveCenter canonical** — placeholder entries written; needs full lock using committed defaults per skeleton §14.
4. **Stop 8 Customer canonical** — three customer placeholders written; needs portal-fixture data per skeleton entry schema.
5. **Stop 9 Agent canonical** — placeholder written; needs full lock after Stop 7 DCs lock (defaultReferral dependency).
6. **§10 Cluster B** (day-to-instructor assignment, external instructor entry point, language-fallback proof) — deferred until Stop 8 customer languages lock.

## Reversibility

Pre-reshape version preserved at `archive/skeleton-monolith-2026-04-14.md` (105KB, 1705 lines, byte-identical to pre-reshape state). To roll back: copy archive file over the split files, delete canonical.json / canonical.schema.json / choreography.md / assertions.yaml / INDEX.md, revert CLAUDE.md pointer. No data loss possible.
