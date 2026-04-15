---
type: handoff
purpose: Prompt-ready brief for an LLM picking up the DiveDispatch happy-path build. Self-contained — cold start should read this, act, not ask.
last_touched: 2026-04-14
---

# Handoff — Continue the DiveDispatch Happy-Path Build

## You are

An LLM picking up a work-in-progress audit that builds the canonical spec for the DiveDispatch happy-path end-to-end test. The spec set lives in `ultraplan/` under a DiveDispatch repo. Previous sessions locked 6 of ~9 audit stops plus admin venues. Three stops remain, and a retroactive re-audit is owed on the locked six. After all stops lock and `§9` P0s close, the run fires against a real browser (via `/happypath` skill). When the run passes green and V1 ships, this artifact set retires.

## Turn 1 — read these, in this order

1. **`ultraplan/INDEX.md`** — routing table, file roles, resume pointer. Start here.
2. **`ultraplan/happy-path-spec-skeleton.md`** §14 Resume Point — current audit state, 10 lessons, committed-default interview states.
3. **`ultraplan/canonical.json`** — scan the `_pending` entries to see where the audit is blocked (dive_center_1, dive_center_2, customer_1–3, agent).
4. **`ultraplan/canonical.schema.json`** — the shape contract. Handwritten, product-intent-driven, not derived from convex schema.
5. **`ultraplan/choreography.md`** — how phases map to canonical keys.
6. **`ultraplan/assertions.yaml`** — expected state per phase.

Everything else in the skeleton (§0–§13, §15–§16) supports these four.

## Your mission, in priority order

### Priority 1: Lock Stop 7 — DiveCenter

Skeleton §14 has the interview state ready with **four committed defaults** (Lesson #5 discipline):

1. 2 DCs (Hug + Nicole)
2. Secondary DC = Nicole (seed-match, slugRef to equipment_manager_3)
3. Deliberate-incomplete = `associations_initial: []` on dive_center_2
4. customerLanguages = seed-canonical (HUG_OCEAN `['zh-CN','zh-TW','th','en']`, NICOLE_DC `['zh-TW','zh-CN','en','th']`)

Action: replace the `_pending` placeholders at `canonical.stakeholders.dive_center_1` and `dive_center_2` with full canonical entries. Do NOT ask Matt about any of these four unless a convex-schema or FE reality contradicts the default.

### Priority 2: Lock Stop 8 — Customer

Lighter portal template. Three customers (O+AP booking requires multi-customer for Cluster B variations). Schema per `canonical.schema.json $defs.entryCustomer`. Commit reasonable defaults (Lesson #5):
- Languages drawn from the instructor coverage matrix (needs at least one customer with a language only instructor_3 Wei Chen can serve, to exercise language fallback in Act III).
- One deliberate-incomplete pair (e.g. `emergencyContact_initial: null` → `_completed: {...}`).
- Medical flag diversity: at least one customer with `medicalFlag: true` to trigger Scene 6 in Act IV.
- DOB, sizing, cert level plausible for O+AP course.

Action: replace `customer_1` / `customer_2` / `customer_3` `_pending` placeholders.

Stop 8 unblocks §10 Cluster B (B.1 day-to-instructor schedule, B.2 external-instructor Day 5, B.3 language-fallback proof). Commit defaults for all three in the same turn and move them from §10 into `choreography.md` Act II Phase 4 notes.

### Priority 3: Lock Stop 9 — Agent

Depends on Stop 7 DCs being locked (defaultReferral slugRef target). Skeleton §14 describes the pattern. The current `agent` entry is mostly filled but marked `_pending` — replace `_pending` with real canonical values once DC slugs exist.

### Priority 4: Retroactive re-audit Stops 1–6 under three-way framing

Previous audits used `convex/schema.ts` as the yardstick (schema-driven). The three-way framing introduced this session is:

- **Product intent** (Product Definition + V1 Done Criteria) is the bar.
- **Schema** is verified against the bar — if the schema is missing or wrong-shaped, file a P0.
- **FE form** is verified against the bar — if a field is canonical-required but no FE input exists, file a P0.

Walk each locked stakeholder entry (compressor_1, compressor_2, equipment_manager_1–3, boat_1, boat_2, instructor_1–3, dive_master, pool_1–4, admin_venues.kata_beach). For each, sweep the relevant FE form (`src/components/profiles/<role>-profile-form.tsx`) and the Product Definition + V1 Done Criteria sections describing that role. Add any missing canonical fields. File new P0s for schema/FE gaps.

Expected surface count: 5–15 new P0s. Example already found: `confinedCapable` was silent on pools, now added. More likely hiding on users (dateOfBirth, nickname, defaultLocation), on operator tables (stakeholderPreferences ordering), and on equipment (inventoryOverrides currently stored as a free-text string — likely needs structured fields).

## Same-turn discipline (five-file touch per stop)

Every stop that locks updates **all five files** in the same turn:

1. `canonical.json` — `_pending` replaced with real entry. Run `ajv-cli validate -s canonical.schema.json -d canonical.json` or `python3 -c 'import json; json.load(open("ultraplan/canonical.json"))'` at minimum.
2. `canonical.schema.json` — only if the entry shape needs extension (rare after Stop 8; entryCustomer shape may need refinement).
3. `choreography.md` — Act phases reference the now-resolved canonical keys; flow updates if the stop changes the run.
4. `assertions.yaml` — `act_N_phase_M` entries updated with concrete expected values referencing the new canonical keys.
5. `happy-path-spec-skeleton.md` — §9 new P0s filed + §14 progress row flipped to DONE + §11 harmonization + `/board` files P0 tickets to `.tickets/` + Stop 8 interview-state overwrites Stop 7.

## Non-negotiable rules (skeleton §14 Lessons — read full text there)

1. **Joint ledger is five files.** Never `.claude/plans/`. Never `Vaults/DiveDispatch/wiki/Plans/`.
2. **Orient to the whole app once, not stop-by-stop.** Before first lock: read `convex/schema.ts` (all tables), `convex/seedData.ts`, `src/components/profiles/*.tsx`, `src/components/account/profile-basic-info.tsx`, `src/lib/constants/roles.ts`.
3. **Verify FE presence before flagging a gap.** Grep, don't assume.
4. **Seed is canonical for values, not for shape.** When seed disagrees with canonical.json, seed wins unless product intent explicitly supersedes.
5. **Commit reasonable defaults.** Every open question carries a committed default. Multi-option A/B/C only on genuine ambiguity (business rules, policy), never on data.
6. **Deliberate-incomplete rule universal.** Every stakeholder type has one user with `<field>_initial` / `<field>_completed` pair that renders them unbookable until the happy path closes the gap.
7. **`isAllowed` / `notAllowed` is role-specific.** Compressor defers; Equipment uses; Pool can use.
8. **Auto-accept = row-level boolean + disabled FE checkbox, except Instructor** (toggleable). DC + Agent are organizers — no column.
9. **Multi-role users share one `users` row, N role profiles.** Reference via `slugRef`.
10. **Admin-added venues live outside `stakeholders`** with sentinel `ownerId: '__unowned__'`.

## What you do NOT do

- **Do not interview Matt on data defaults.** Commit, let him override. Interviews are only for business-rule ambiguity.
- **Do not run the happy-path until every §9 P0 is closed.** Pre-run blocker gate (skeleton §15 rule 4).
- **Do not modify `canonical.json` without re-validating against the schema.** Drift is the failure mode this whole structure prevents.
- **Do not create plan files in `.claude/plans/`.** Amendment #1 to Lesson #1: any plan mode artifact migrates into the five-file ledger and the plan file is deleted.
- **Do not inline literal values in `choreography.md`.** Always reference canonical keys.
- **Do not mark a stop DONE without the five-file touch.** All five, same turn.

## When to stop and ask

Three legitimate reasons:

1. **Business-rule ambiguity** that genuine commits can't resolve — e.g. "should medical allergies block booking or require operator acknowledgement?"
2. **A Lesson conflict** — the lessons appear to contradict or the skeleton says one thing and code says another.
3. **Product intent unclear** — Product Definition + V1 Done Criteria are silent on a field's requiredness and you can't commit a default without guessing.

For everything else — commit defaults, document them, let Matt correct.

## Verification before handing back

Before signaling "Stop N locked," run:

```
python3 -c "import json; d=json.load(open('ultraplan/canonical.json')); s=json.load(open('ultraplan/canonical.schema.json')); print(len(d['stakeholders']), 'stakeholders,', len(d['order']), 'in order')"
```

And sanity: every id in `order` exists in `stakeholders`, no `_pending` remains on the locked stop. Then commit via `/board` for any P0s.

## Retirement criteria (when this handoff prompt becomes obsolete)

All three must hold:

1. Audit COMPLETE — every `_pending` gone from `canonical.json`, every P0 in `§9` closed.
2. One fully green happy-path run — `Observations.md` carries no open findings.
3. V1 has shipped.

At that point: move `ultraplan/*` to `ultraplan/archive/<date>/`, promote content to `Vaults/DiveDispatch/HappyPath/Stops.md` + `Fixture.md` permanent spec, delete this handoff.

Until then: start at `ultraplan/INDEX.md`, execute one stop per session, preserve the five-file discipline.
