---
type: index
purpose: Discovery entry point for the DiveDispatch happy-path artifact set. Read this FIRST — cold LLMs land here.
related_files:
  - happy-path-spec-skeleton.md
  - canonical.json
  - canonical.schema.json
  - choreography.md
  - assertions.yaml
last_touched: 2026-04-14
---

# Happy-Path Artifact Set — Index

This folder holds the canonical spec for the DiveDispatch happy path. Five artifacts, one purpose each. Read this INDEX before touching anything.

## Phase arc

**Audit (current) → P0 fix → Happy-path run → V1 ship.**

**Audit COMPLETE** as of 2026-04-14 — all 9 stops + `admin_venues.kata_beach` locked. We are in the **P0 fix** phase. §9 holds 26 P0s: P0-15..P0-26 ticketed as DD-485..DD-496, P0-1..P0-14 still need backfill. P0-7 (`equipment.manufacturersByGearType`) moved to DERIVED 2026-04-17 post gear-consolidation. After §9 empties, the `/happypath` run fires. After the run passes, V1 ships and these artifacts retire (see skeleton §16).

**Latest extension (2026-04-18):** Stop 2 Gear overlay walkthrough-ready (matrix UI + `bulkSetByManufacturer` shipped). See skeleton §14 → "2026-04-18 extension" subsection.

## Artifact roles

| File | Purpose | Format | Typical reader |
|---|---|---|---|
| [`happy-path-spec-skeleton.md`](happy-path-spec-skeleton.md) | Meta, governance, glossary, audit state, lessons, P0 queue, resume pointer, execution rules | Markdown | LLM resuming the audit |
| [`canonical.json`](canonical.json) | Every value for every stakeholder + admin venue. Validated against `canonical.schema.json` on save. | JSON | Runtime LLM needing a specific field value |
| [`canonical.schema.json`](canonical.schema.json) | Handwritten JSON Schema (draft-07) describing product-intent shapes per role. NOT auto-derived from `convex/schema.ts`. Gaps between canonical / schema / FE → P0 blocker. | JSON Schema | Anyone editing canonical.json |
| [`choreography.md`](choreography.md) | Play-by-play for Acts I–V. References canonical keys, never inlines values. Each phase cites Scene, LAW invariant, min verification layer, and assertion key. | Markdown | Runtime LLM executing the run |
| [`assertions.yaml`](assertions.yaml) | Expected DB + UI state per `(act, phase)`. Machine-readable. | YAML | Runtime LLM verifying post-phase state |

## Routing table — "I want to add X, write to Y"

| I want to add… | Goes to | Validates via |
|---|---|---|
| A new stakeholder entry (or field on an existing entry) | `canonical.json` | `ajv validate -s canonical.schema.json -d canonical.json` |
| A new field shape (new stakeholder type, new role concept) | `canonical.schema.json` first, then `canonical.json` | same |
| A new run step / phase edit | `choreography.md` under the right Act; reference canonical keys, never inline values | manual: grep for literal proper nouns that should be keys |
| A new expected-state assertion | `assertions.yaml` keyed by `(act, phase)` | YAML parse |
| A new P0 blocker | `happy-path-spec-skeleton.md` §9 | convention (see existing P0 template) |
| A new audit lesson | `happy-path-spec-skeleton.md` §14 lessons | convention |
| A new open design question | `happy-path-spec-skeleton.md` §10 — must carry a committed default per Lesson #5 | convention |
| A new execution-phase rule (runtime behavior) | `happy-path-spec-skeleton.md` §15 | convention |
| Retirement / archiving | `archive/` + update `archive/MIGRATION.md` | none |

**Nothing goes in `.claude/plans/` or `Vaults/DiveDispatch/wiki/Plans/`.** The joint ledger is: `skeleton.md` + `canonical.json` + `canonical.schema.json` + `choreography.md` + `assertions.yaml`. Per skeleton Lesson #1.

## Resume pointer

**Resuming the audit?** Open `happy-path-spec-skeleton.md` → §14. Stops 1, 2, 4 locked. **PENDING: Stop 3 (Boat), Stop 6 (Pool), Stop 7 (DiveCenter), Stop 8 (Customer), Stop 9 (Agent), admin_venues.** Next up: Stop 3 (Boat). The 2026-04-18 extension subsection captures Stop 2 Gear overlay readiness for walkthrough.

**Running the happy-path?** Open `choreography.md` → Act I Phase 1. Follow `§15 Execution Conventions` in skeleton (pause rule, post-run observation routing).

**Filing a blocker mid-session?** Open `happy-path-spec-skeleton.md` → §9; follow the existing P0 template.

## Discovery (so future LLMs find this)

Three mechanisms layered — any one surfaces the artifact set:

1. **`CLAUDE.md` pointer** (DiveDispatch project CLAUDE.md): one line points here.
2. **Session-start hook** (`.claude/hooks/session-start-vault-context.sh`): injects ultraplan audit status at every session start. Output includes which stops remain, open P0 count, last lock date.
3. **This `INDEX.md`** at `ultraplan/INDEX.md` — canonical routing. Anyone in `ultraplan/` reads this first.

## Validation workflow

On every edit to `canonical.json`:

```
npx ajv-cli validate -s ultraplan/canonical.schema.json -d ultraplan/canonical.json
```

Pre-commit hook candidate. If ajv is not installed: `npm install -g ajv-cli` (or use any JSON Schema validator).

Silent drift (field in schema but not canonical, field in canonical but schema doesn't permit it) becomes impossible as long as the validator runs.

## Per-stop audit discipline (same-turn)

When locking a stop, all five files touch in one turn:

1. `canonical.json` — write the stakeholder entry (validates against schema)
2. `canonical.schema.json` — if new entry shape (likely only for customer_* / dive_center_* / agent if schemas differ from what's already drafted)
3. `choreography.md` — update the Act I phase row to reference the new canonical key(s); add any new flow steps
4. `assertions.yaml` — add / update the `act_X_phase_Y` entry
5. `happy-path-spec-skeleton.md` — §9 blockers filed + §14 progress row flipped to DONE + §11 harmonization + `/board` files P0 tickets

## Three-way field audit framing

Per skeleton Lesson (new): the canonical field list is the UNION of:

- **Product intent** (Product Definition, V1 Done Criteria — the bar)
- **Convex schema** (current code — may lag intent)
- **FE form surfaces** (current forms — may diverge from either)

For every canonical field, verify:

- Intent requires it (or explicitly declares it optional/forbidden)
- Schema supports it — **P0 if missing or wrong shape**
- FE surfaces it — **P0 if missing**

Schema-silent ≠ gap-absent. `canonical.schema.json` is the yardstick; schema and FE verify against it.

## Retirement criteria

Artifact set retires when all three hold:

1. Audit is COMPLETE — every canonical entry locked, every P0 closed
2. Happy-path run completes one fully green pass
3. V1 has shipped

Retirement action: everything moves to `archive/` with a dated snapshot; `Vaults/DiveDispatch/HappyPath/Stops.md` + `Fixture.md` carry the permanent spec forward. See skeleton §16 for full procedure.
