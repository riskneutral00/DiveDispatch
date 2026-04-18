---
type: plan
tier: semantic
summary: "Answer-fillable happy-path contemplation brief: purpose, locked context, open questions with recommendations, verification layers"
tags: [happy-path, spec, interview, llm-brief, answer-fillable]
updated: 2026-04-17
decay: 30d
status: active
source: ai
---

# DiveDispatch Happy Path — Answer-Fillable Contemplation Brief

**Status:** Active working brief. Matt fills answer slots independently; Claude reviews later and promotes locked answers into executable specs.

## How to use this document

Each open question below has five fields:

- **Question:** what needs to be answered.
- **Why it matters:** consequence if left unanswered.
- **Claude's recommendation:** a suggested answer + reasoning (defeasible).
- **Matt's answer:** write your answer inline, replacing `_(blank)_`.
- **Verification layer:** which of Schema (S) / Mutation (M) / UI (U) the answer affects.

`LOCKED` items are decisions already made; leave alone unless superseding. Claude's 8 commentary notes sit at §11 — read those alongside answering.

---

## 0. Glossary

- **Stakeholder** — any role that owns or confirms part of a booking. Split into three layers:
  - **Resource stakeholders** (Stops 1–6): Compressor, Equipment Manager, Boat, Instructor, DiveMaster, Pool. Onboarded independently; don't cross-reference each other except via multi-role users sharing rows.
  - **Customer** (Stop 8): bookee; joins via portal token. Lighter shape — no userRoles row, no autoAccept, no isAllowed.
  - **Operator stakeholders** (Stops 7, 9): DiveCenter, Agent. Orchestrate bookings; depend on resources. Agent additionally depends on DC for referral functionality (ordering: 1–6 → 8 → 7 → 9).
- **Stop** — a stakeholder audit entry in this skeleton (Stop 1 = Compressor, Stop 9 = Agent). **Not the same as "Stop" in `Vaults/DiveDispatch/HappyPath/Stops.md`**, which numbers happy-path walkthrough pages (Boot, Dashboard, Wizard, …).
- **Canonical ledger** — §7.12 Act I — Field Ledgers. LIVE, editable source of truth for happy-path stakeholder data. Every FE/BE field for an in-scope role has a canonical value here.
- **slugRef** — a reference in one stop's canonical entry to a user defined in another stop's entry, used for multi-role users. Prevents duplication (Lesson #9).
- **Multi-role user** — one `users` row with N role profiles. Canonical examples: HUG_OCEAN (DC + Boat + Pool + Equipment), NICOLE_DC (DC + Equipment), NEPTUNE (DC + Pool), PHUKET_DC (DC + Boat), SCUBA_REVOLUTION (DC + Equipment).
- **Deliberate-incomplete rule** — every stakeholder type has one user with a seeded gap (`<field>_initial`) that makes them unbookable until the happy path closes the gap (`<field>_completed`). Tests completeness gates.
- **Auto-accept** — row-level boolean + disabled FE checkbox on Compressor, Equipment, Boat, Pool, DiveMaster. **Instructor is the exception** (toggleable). DC + Agent have no column (organizer roles).
- **Pre-run blocker** — any P0-N in §9. All must close before the happy-path run can execute.
- **Seed-canonical** — values from `convex/seedData.ts`. When seed and skeleton disagree, seed wins (Lesson #4).
- **Run** — one end-to-end execution of the happy path. Driven by `/happypath` skill against `Vaults/DiveDispatch/HappyPath/Stops.md`. Pauses per §15 Execution Conventions.
- **Scene** — a V1 Done Criteria scenario (see `Vaults/DiveDispatch/Product/V1 Done Criteria.md`). Scenes 1–5 are the canonical "V1 works" set. Every Act/phase in §8 cites which Scene it validates.
- **Fixture** — byte-identical input data used by every run (`Vaults/DiveDispatch/HappyPath/Fixture.md`). Derived from §7.12 canonical ledger. Variance between runs with same fixture = real defect.
- **Observation** — a finding emitted by a run into `Vaults/DiveDispatch/HappyPath/Observations.md`. Rolling log; deduplicated; may get promoted to a §9 P0 or a §14 audit fallout item.
- **stakeholderPreferences** — the per-operator preference record (preferred instructors / boats / pools / equipment / compressor per language, in ordered lists). Drives the automatic fill on booking creation (see `HappyPath.md`). Not the same as per-user settings; it's a dedicated Convex table.

## 0.5 Navigation

**Phase arc:** Audit (current) → P0 fix → Happy-path run → Ship.

**This skeleton is part of a 5-artifact set.** See [`INDEX.md`](./INDEX.md) for the routing table and insertion protocol. Joint ledger: `skeleton.md` + `canonical.json` + `canonical.schema.json` + `choreography.md` + `assertions.yaml`.

- **Resuming an audit session?** Jump to §14 Resume Point.
- **Looking for a specific stakeholder's canonical value?** [`canonical.json`](./canonical.json) — direct lookup.
- **Checking what fields a role should have?** [`canonical.schema.json`](./canonical.schema.json) — product-intent shapes.
- **Running the happy-path (play-by-play)?** [`choreography.md`](./choreography.md). Execution rules: §15. Assertions: [`assertions.yaml`](./assertions.yaml).
- **Filing a blocker?** §9 Prerequisites.
- **Understanding scope/authorities?** §1–§6.
- **Reconciling conflicting advice?** §10 (global open Qs) · §11 (Claude's recommendations) · §12 (tensions) · §13 (anti-patterns) · §14 lessons (audit-process). Each section's preamble declares what belongs there.
- **Meta (cadence, ownership, reset, retirement)?** §16 Meta.

### Data flow

```
Audit (§14 skeleton)
    ▼
canonical.schema.json (product intent)  ← handwritten, the yardstick
    ▼ validates
canonical.json (every value)
    │
    ├─► Fixture.md (Vaults/DiveDispatch/HappyPath/) — run inputs
    └─► assertions.yaml — expected post-phase state

choreography.md (Acts I–V play-by-play, references canonical keys)
    ▼
/happypath runner ──── pauses per §15 Execution Conventions
    ▼
Observations.md (rolling log) ──► §9 Prerequisites / §14 fallout ──► gates next run
```

Canonical values never inline into `choreography.md` — phases reference canonical keys (e.g. `stakeholders.compressor_1.users.firstName`) so the runtime resolves once. Drift between canonical and intent is caught by `ajv validate` before the run fires.

---

## 1. Purpose

The happy path proves DiveDispatch's distributed system converges **and** survives every realistic edge case, end-to-end, without hidden failures in handoffs between operator, customer, instructor, boat, pool, equipment, compressor, and post-trip conversion.

The happy path is exhaustive, not minimal. It covers:
- stakeholder onboarding for every role DiveDispatch supports
- booking creation from scratch through `Completed`
- portal completion, partial progress, reminder firing
- referral mode switching mid-booking
- preference cascade and fallback
- post-trip account conversion and review prompts
- nook-and-cranny edge cases: language mismatch, free-text fallback, channel variation, resource decline, medical block-and-lift, etc.

"Can a booking row be created" is explicitly not the test.

## 2. Testability Principle — Testable Before UI

The happy path **must be verifiable at the data-model and Convex-mutation layer before any browser run**. UI execution is the final validation, not the only one.

### Verification layers (every stop declares its minimum layer)

| Layer | What it proves | Tools |
|---|---|---|
| **S — Schema** | Shape correctness, LAW invariant holds, index presence, field population | Static schema assertion, Convex `data` inspection, Convex `functionSpec` |
| **M — Mutation** | State transition fires, cascades ripple correctly, reservations write atomically with snapshots, guards reject invalid inputs | `convex-test` integration tests (vitest), Convex `runOneoffQuery` |
| **U — UI** | Rendered surface matches spec, user flow completes, focus/input behavior correct, visual regressions absent | Playwright, `/happypath` skill, visual-verdict, manual walkthrough |

**Rule:** No stop is complete until it passes its declared minimum layer. UI-only verification is a smell — either (a) the data model is not observable enough, or (b) we need to add an observability primitive before relying on UI.

## 3. LAW Invariants Anchor

From `CLAUDE.md`:

1. **No exclusive-unit dual-hold.** Exclusive inventory (e.g., instructor time-block, boat seat-for-activity) cannot be held by two bookings for overlapping sessions.
2. **Pooled decrement, zero-block.** Pooled inventory (e.g., equipment rental count, pool capacity) decrements on hold; blocks ONLY when the count reaches zero.
3. **Same-mutation snapshot atomicity.** All `AvailabilitySnapshot` updates occur in the same Convex mutation as the `Reservation` write — no race for the last spot.

**Rule:** Every stop that writes inventory or moves reservation state cites which LAW it exercises. A LAW that is not exercised anywhere in the happy path is a spec gap, not an omission.

## 4. Start / End

**Start point:** Zero meaningful pre-created business state. No seed-data shortcut for actors involved in the path. Stakeholders created via UI; persistence verified via actual product surfaces.

**End point:**
- booking reaches `Completed`
- passes through every normal phase except `Cancelled`
- remains visible/persistent for every involved stakeholder
- customer prompted to create an account (prefilled from portal data)
- customer finishes account info
- customer asked to leave a review

## 5. Scope / Out of Scope

### In scope

Stakeholder creation, onboarding depth, persistence expectations, booking creation, invite channels, portal behavior, incomplete-state reminders, preference + referral, resource assignment/fallback, booking visibility + state transitions, post-trip conversion, LAW invariant verification, schema- and mutation-layer assertions.

### Out of scope (unless pulled back in)

- Seed-data fast-forward for any in-scope actor.
- Compressing any stakeholder setup phase.
- Collapsing into a one-booking demo.
- Treating this as a pure browser script instead of a system probe.

## 6. Authorities

Primary references. Each carries a specific role in the audit → run → observation loop.

| File | Role in the loop |
|---|---|
| `Vaults/DiveDispatch/Product/Product Definition.md` | Canonical "what DiveDispatch IS." Every spec must trace back to it. |
| `Vaults/DiveDispatch/Product/V1 Done Criteria.md` | Defines **Scenes 1–5** — the V1 Scene names §8 Acts cite (§11 rec #2). |
| `Vaults/DiveDispatch/Product/HappyPath.md` | MVP end-to-end flow per stakeholder (Agent / Operator / Customer). Source of `stakeholderPreferences` behavior. |
| `Vaults/DiveDispatch/Product/WhatAmIDoing.md` | The plan. Four Batches to the finish line. Read when losing the thread. |
| `Vaults/DiveDispatch/Product/Launch-Walkthrough.md` | Walkthrough spec organized by Act → Scene per user type, with Gate tickets between acts. |
| `Vaults/DiveDispatch/HappyPath/Stops.md` | **Executable spec.** `/happypath` parses H2 stops (Where/Action/Expect/Audit/Known issues). This skeleton's §8 Acts map onto Stops.md stops. |
| `Vaults/DiveDispatch/HappyPath/Observations.md` | Rolling log of findings across runs. Deduplicated; feeds §9 blockers and §14 fallout. |
| `Vaults/DiveDispatch/HappyPath/Fixture.md` | Byte-identical run inputs. Derived from §7.12 canonical ledger. Variance between runs with same fixture = real defect. |
| `Vaults/DiveDispatch/HappyPath/Runs/` | Per-run output directory (each run writes a timestamped log). |
| `CLAUDE.md` | LAW invariants (3 non-negotiable architectural rules). |

---

## 7. Locked Context & Canonical Ledger

§7.1–§7.11 are **frozen** — locked decisions preserved from the original brief. Do not edit unless formally superseding. §7.12 is **ACTIVE** — the live canonical stakeholder ledger that the audit (§14) builds up stop by stop.

### 7.1 Global rules

- `LOCKED` **No seed data** — all entities created via UI in the full path. Mutation-layer tests may seed minimal fixtures in isolation.
- `LOCKED` **Booking finish line = `Completed`** — booking goes through every normal stage except `Cancelled`.
- `LOCKED` **Happy path extends beyond booking completion** — includes account-creation prompts, prefilled account conversion, finishing account info, review prompt.
- `LOCKED` **Persistence matters everywhere** — if data should persist in production, it must persist in development during the happy path.
- `LOCKED` **Stakeholder creation is not compressed** — each stakeholder type gets its own deep phase.

### 7.2 Stakeholder strategy

- `LOCKED` Resource stakeholders are created before operator stakeholders.
- `LOCKED` Agent is the last stakeholder/operator created.
- `LOCKED` Each stakeholder creation phase includes: account creation, role selection, onboarding, required fields, optional fields, preferences/settings, persistence verification.

### 7.3 Instructor matrix

- `LOCKED` Four in-system instructors exist: (1) English-only, (2) Traditional Chinese, (3) Simplified Chinese, (4) Thai-only.
- `LOCKED` During booking, each day uses one of the four instructors.
- `LOCKED` There will still be insufficient instructor coverage.
- `LOCKED` Agent or dive center can add an extra instructor as free text.
- `LOCKED` External / not-in-system instructor is allowed in the happy path.

### 7.4 Agent setup

- `LOCKED` A new user creates an account and selects Agent.
- `LOCKED` They land on the Agent dashboard.
- `LOCKED` They go to avatar/profile/settings.
- `LOCKED` They fill all agent fields: required, optional, preferences, settings.
- `LOCKED` Agent data persistence is verified.
- `LOCKED` In settings: default referral is unchecked; preferred dive center is still set.

### 7.5 Booking start

- `LOCKED` Agent creates the first booking.
- `LOCKED` Agent drags the `O+AP` quick-book pill onto tomorrow.
- `LOCKED` Booking page / booking flow opens.

### 7.6 Customers and invite channels

- `LOCKED` Step 1 begins as normal.
- `LOCKED` Three customers are added.
- `LOCKED` Customer 1: English, American phone, email invite.
- `LOCKED` Customer 2: Simplified Chinese, Chinese phone, WhatsApp invite.
- `LOCKED` Customer 3: Traditional Chinese, Taiwan phone, LINE invite.
- `LOCKED` Each customer must receive their invite link before the agent can click Next.

### 7.7 Partial portal progress

- `LOCKED` Customers can save and resume later.
- `LOCKED` Partial progress is intentional in the happy path.
- `LOCKED` Customer 1 fills out Step 1 only; Customer 2 Step 2 only; Customer 3 Step 3 only.
- `LOCKED` None submit at that point. Incomplete state exists so reminder behavior can be tested.

### 7.8 Referral / preference-switch test

- `LOCKED` Happy path tests feature combinations, not one booking mode.
- `LOCKED` One booking switches modes.
- `LOCKED` Booking starts with agent default referral off.
- `LOCKED` In Step 2, agent re-checks referral to the preferred dive center.
- `LOCKED` Step 2 is the switch point from agent-driven to referral-driven behavior.
- `LOCKED` After referral is toggled on, booking behavior reflects the dive center's preference source.

### 7.9 Resource assignment / visibility

- `LOCKED` Booking supports both in-system instructor matching and free-text external instructor fallback.
- `LOCKED` All involved stakeholders view the booking appropriately.
- `LOCKED` Successful booking persists and remains viewable by all stakeholders.

### 7.10 Portal completion and convergence

- `LOCKED` Eventually customers complete the portal.
- `LOCKED` Portal phases: Contact & Identity, Medical, Waiver, Equipment, Safety.
- `LOCKED` Booking cannot converge until customer-side completion is done.
- `LOCKED` Original customer contact method matters from booking creation through reminders/prompts.
- `LOCKED` If forms are still incomplete before designated time, customer is reminded.
- `LOCKED` Day-before reminder belongs in the happy path.
- `LOCKED` Last-day / post-trip message belongs in the happy path.
- `LOCKED` Post-trip message includes: create account, finish account info, leave review.
- `LOCKED` Booking auto-advances when all conditions converge.
- `LOCKED` Conditions: operator complete, customer complete, required resources confirmed, no blocking condition.
- `LOCKED` No one manually triggers the advance.

### 7.11 Completion and post-trip conversion

- `LOCKED` `Active` matters as a display phase.
- `LOCKED` Final booking status is `Completed`.
- `LOCKED` Booking persists and remains viewable to all stakeholders.
- `LOCKED` Customer is asked to create an account.
- `LOCKED` Account creation is pre-populated from portal data.
- `LOCKED` Customer finishes remaining account info.
- `LOCKED` Customer is asked to leave a review.
- `LOCKED` Three account-creation prompts: (1) after portal submission, (2) 8pm day before activity, (3) after booking completion with review prompt.
- `LOCKED` Post-conversion state includes: account holder exists, dive/trip history preserved, future reuse/prefill benefits exist.

### 7.12 Act I — Field ledgers (canonical prefill) — **ACTIVE**

**This is the live ledger.** §14 audit builds it up stop-by-stop; edit in place when a stop locks.

Canonical stakeholder data for the happy path is defined in **one JSON document** below. Keys match Convex table shapes where applicable; `userId` / `tokenIdentifier` / `slug` are assigned at runtime and omitted here. `isAllowed` and `notAllowed` default to `[]` when absent. Nitrox canonical **O₂ 32%** applies to messaging and future `nitroxO2Percent` when implemented.

#### 7.12.0 Canonical entry schema

Every entry in the ledger conforms to one of four shapes. Required fields below; additional role-specific fields permitted.

| Entry type | Required fields | Min verification layer (§2) | Notes |
|---|---|---|---|
| Resource stakeholder (Stops 1–6) | `id`, `role`, `user` or `slugRef`, role-specific schema fields, `isAllowed`/`notAllowed` if role-applicable, `<field>_initial` + `<field>_completed` pair if carrying the deliberate-incomplete gap | **S + U** (field presence in DB after onboarding + UI creation flow completes) | Auto-accept lives user-level on `stakeholderPreferences.acceptanceMode` (seed default: Instructor → `PrePayRequired`, others → `Auto`) — no per-resource flag. |
| Customer (Stop 8) | `id`, portal fixture fields (firstName, lastName, email, phone, DOB, certLevel, medical y/n, emergencyContact, languages), one `<field>_initial` + `<field>_completed` pair | **S + M + U** (portal token valid, mutation accepts partial progress, UI submits) | No userRoles row, no isAllowed. Lighter template. |
| Operator stakeholder (Stops 7, 9) | `id`, `role`, `user` or `slugRef`, organizer schema fields, `isAllowed`/`notAllowed`, `customerLanguages`, deliberate-incomplete pair | **S + U** (organizer profile persists, UI flows complete) | Agent additionally carries `defaultReferral` or equivalent. |
| admin_venues (sibling of `stakeholders`) | `id`, `venues` fields, `inventoryUnits.ownerId: '__unowned__'`, `ownerType: 'DiveSite'`, `verified: true` | **S** (row present, ownerId sentinel correct) | No `userId`. Exempt from deliberate-incomplete rule. No UI flow — admin-seeded. |

**Multi-role users:** when a user owns rows in multiple stops (HUG_OCEAN, NICOLE_DC, NEPTUNE, PHUKET_DC, SCUBA_REVOLUTION), define the `user` block once in the stop where the user first appears. Subsequent stops reference via `slugRef` — do not duplicate.

**Deliberate-incomplete rule (applies to every stakeholder type).** For each role, **one user** carries an intentional gap that renders them unbookable until the happy path closes it. Convention: shadow field pair `<field>_initial` (empty/gap starting state seeded into the system) and `<field>_completed` (post-walkthrough target state). This tests profile-incomplete guards, booking-picker completeness gates, and inventory-availability gates per role. Current assignments:

| Role | Incomplete user | Gap field | Close-the-gap action in walkthrough |
|---|---|---|---|
| Compressor | compressor_2 (Chalong Pier) | `gasMixes_initial: []` | Add `['air', 'nitrox']` via Gas Mixes tab |
| Equipment | equipment_manager_3 (Nicole) | `inventoryOverrides_initial` missing mask SKUs | Add 1 mask SKU via Inventory tab |
| Boat | boat_2 (PHUKET_DC) | `vessels_initial: []` | Add MQ5 + MQ7 via Fleet/Vessels tab |
| Instructor | instructor_3 (Wei Chen) | `teachingLanguages_initial: []` | Add `['zh-CN', 'zh-TW', 'th', 'en']` via Credentials tab |
| DiveMaster | dive_master (Arisa Kanchanaburi) | `teachingLanguages_initial: []` | Add `['th', 'en']` via Credentials tab |
| Pool | pool_3 (Water Pro) | `maxCapacity_initial: 0` | Set capacity to 25 via Capabilities tab |
| DiveCenter | Nicole (shared user with Nicole Equipment; Equipment gap covers) | — | — |
| Agent | TBD (Stop 9) | TBD — likely `defaultReferral` | TBD |
| AdminVenue (Kata Beach) | — | — exempt (admin-added, no onboarding, no stakeholder gap rule) | — |

### Canonical data: see `canonical.json` + `canonical.schema.json`

The full JSON ledger has moved to [`ultraplan/canonical.json`](./canonical.json), validated against [`ultraplan/canonical.schema.json`](./canonical.schema.json). Edit canonical values there; run `npx ajv-cli validate -s ultraplan/canonical.schema.json -d ultraplan/canonical.json` after every change.

This skeleton section (§7.12) retains only the governance: entry schema (§7.12.0 above), deliberate-incomplete table (above), multi-role user rule, admin-add convention (below). All stakeholder values live in `canonical.json`.

**Admin-add convention:** `admin_venues` is a sibling of `stakeholders` — entries have no user, no onboarding stop, no `userId` on `venues`, and use sentinel `ownerId: '__unowned__'` + `ownerType: 'DiveSite'` on `inventoryUnits`. Admin pre-seeds these before Stop 1 begins. Happy-path booking forms reference them as selectable dive-site options.

**Resume:** `canonical.json` is the single source for prefilled onboarding; align UI steps and DB assertions (in `assertions.yaml`) to these values (adjust emails / slugs when wiring to real Clerk/Convex ids).

---

## 8. Proposed Acts partition

Five Acts partition the run: **I Onboarding · II Booking Convergence · III Variation Matrix · IV Branch Probes · V Post-Trip Conversion**.

**Full play-by-play moved to [`choreography.md`](./choreography.md).** Each phase there cites canonical keys, Scene citations (per `V1 Done Criteria.md`), min verification layer (S/M/U per §2), and LAW invariants exercised (per §3). Expected state per phase lives in [`assertions.yaml`](./assertions.yaml).

- Choreography references canonical keys — never inlines values (prevents drift).
- Assertions keyed by `act_N_phase_M` — runtime diffs actual vs expected.
- Every LAW must be exercised at least once across the Acts (§3 rule).

## 9. Prerequisites (known blockers)

### P0-1 — `submitToDraft` writes only the instructor reservation

- **Observation:** `Vaults/DiveDispatch/HappyPath/Observations.md:8–14`
- **Impact:** Pool, Equipment, Compressor reservations never created. FSM guard keeps booking in Draft permanently. Act II spine is red-lined.
- **Action:** Ticket as P0 before any full happy-path run. See L.1.

### P0-2 — `customerLanguages` lives on `users` instead of on operator role tables

- **Source:** Stop 1 audit (this skeleton — per Lesson #1, §14 + §9 are the only canonical ledger).
- **Impact:** Non-operator roles (Compressor, Equipment, Boat, Pool, Instructor, DiveMaster) carry a field they do not logically own. Canonical JSON for Stops 8 (DC) + 10 (Agent) cannot assert `agents.customerLanguages` because the column does not exist yet.
- **Action:**
  - Schema: remove `users.customerLanguages` (`convex/schema.ts:30`); tighten `diveCenters.customerLanguages` to required min 1 (line 329); add `agents.customerLanguages` required min 1 (line 502-515).
  - FE rewire: `src/components/profiles/agent-profile-form.tsx:56-60, 78-80` — switch read path from `me.customerLanguages` to `p.customerLanguages`.
  - UI form fields already shipped on DC + Agent; no new form work.

### P0-3 — `compressors` table missing `nitroxO2Percent`

- **Source:** Stop 1 audit (this skeleton — per Lesson #1).
- **Scope narrowed 2026-04-17:** `autoAccept` portion withdrawn (see P0-19) — auto-accept lives user-level on `stakeholderPreferences.acceptanceMode`. Nitrox range portion remains.
- **Impact:** Compressor canonical JSON declares `nitroxO2Percent: 32`. Schema rejects nitrox min/max writes today. Stop 1 UI run cannot complete without the columns.
- **Action:**
  - Schema: add `compressors.nitroxMin: v.optional(v.number())` + `compressors.nitroxMax: v.optional(v.number())` (integer, range 22–40, both required in mutation iff `gasMixes` includes `'nitrox'`, min ≤ max).
  - Update `convex/compressors.ts:17-34` create + update args.
  - Update `convex/seedData.ts` compressor fixtures.
  - Extend zod validators in `src/lib/profile-form/profile-shared.ts`.

### P0-4 — Seed `SCUBA_MARKET.gasMixes` includes `'trimix'` ✅ RESOLVED

- **Source:** Stop 1 audit (this skeleton — per Lesson #1).
- **Resolution:** Trimix removed from canonical `GAS_MIXES` and seed data. Only `'air'` and `'nitrox'` remain. Nitrox gains a min/max range (22–40%) instead.

### P0-5 — Compressor profile form missing nitrox dropdown

- **Source:** Stop 1 audit (this skeleton — per Lesson #1).
- **Scope narrowed 2026-04-17:** auto-accept FE display withdrawn (see P0-19).
- **Impact:** With P0-3 schema fields live, FE still cannot capture `nitroxMin` / `nitroxMax`. Stop 1 UI run cannot complete without the input path.
- **Action:** `src/components/profiles/compressor-profile-form.tsx` — conditional scrollable integer select (22–40) when `nitrox` is selected in gas mixes.

### P0-6 — `equipment` table missing `autoAccept` — WITHDRAWN

- **Status:** WITHDRAWN 2026-04-17 — see P0-19. Auto-accept is user-level on `stakeholderPreferences.acceptanceMode`. No per-resource column added.

### P0-7 — `equipment.manufacturersByGearType` must be required non-empty — DERIVED

- **Status:** DERIVED 2026-04-17 (gear-consolidation session, commits `81203c3c` + `08ea8e74`). Field is now server-synced from `equipmentInventory` rows via `convex/lib/equipmentManufacturersSync.ts::syncManufacturersByGearType`, invoked from `addItem`, `updateItem` (when manufacturer changes), `removeItem`, and `bulkSetByManufacturer`. Field is no longer client-writable — "required non-empty" is an emergent property of having ≥1 inventory row per required gear type.
- **Source:** Stop 2 audit.
- **Original impact:** An Equipment profile with zero declared gear types is nonfunctional for bookings.
- **Resolution:** Enforcement moved from schema-layer constraint to runtime readiness gate in `equipmentGearCompleteness` (commit `c1f992d3`), which asserts per-gear-type completeness against `GEAR_REQUIRED_FIELDS`. The booking-picker surfaces the Equipment only when the readiness gate passes. Invariant preserved; enforcement layer changed.

### P0-8 — Booking-picker completeness gate (investigation)

- **Source:** Stop 2 audit; Matt's deliberate-incomplete Nicole test.
- **Impact:** Nicole starts with zero mask inventory. The happy path expects the Equipment picker in the booking form to hide / disable her until mask inventory is added. If the picker just lists all Equipment profiles regardless of inventory state, the test fails and path cannot demonstrate the gate.
- **Action:** Investigate how the booking-form Equipment dropdown builds its list. Grep `src/components/booking/**` for Equipment option rendering. If the filter is absent, file as a distinct blocker; if the filter exists, document where and cite the query.

### P0-9 — `boats` table missing `autoAccept` — WITHDRAWN

- **Status:** WITHDRAWN 2026-04-17 — see P0-19. Auto-accept is user-level on `stakeholderPreferences.acceptanceMode`. No per-resource column added.

### P0-10 — Strip `boats.fleet[].seatCapacity`

- **Source:** Stop 3 audit. Extended principle: strip any vestigial vessel-level duplication found in future stops.
- **Impact:** Schema declares optional vessel-level `seatCapacity`. FE has no input path. Seed never writes. Duplicates `maxPax` conceptually. Canonical §7.12 omits the field.
- **Action:**
  - Schema: remove `seatCapacity: v.optional(v.number())` from `convex/schema.ts:371`.
  - Validator: remove from `convex/boats.ts:25` fleet entry validator.
  - Form state: remove any leftover references in `src/components/profiles/boat-profile-form.tsx` (none found — FE already silent).

### P0-11 — Rename `boats.fleet` → `boats.vessels` (and inner field renames)

- **Source:** Stop 3 audit. Current names category-error — "fleet's boatName" reads as fleet-level attribute of an abstract collection rather than vessel attribute.
- **Impact:** Canonical §7.12 renders the array as `vessels` with inner `name` / `type`. Schema column and inner field names diverge from canonical until migration lands.
- **Action:**
  - Schema: rename `boats.fleet` → `boats.vessels`; inside, `boatName` → `name`, `boatType` → `type`. Keep `maxPax`, `minPax`, `routes`, `cutoffHours`.
  - Mutation: `convex/boats.ts:20-35` (validator), `:37-51` (create handler, hasCompressor derivation reads `v.type`), `:53-71` (update handler).
  - FE: `src/components/profiles/boat-profile-form.tsx` — rename all local state fields, props, and payload mappers (BoatFleetFormState → BoatVesselsFormState if you want to propagate, or keep local name). `FleetEntryCard` → `VesselEntryCard`.
  - Seed: `convex/seedData.ts` HUG_OCEAN.boat, NEPTUNE (no boat, skip), PHUKET_DC.boat — rename `fleet` → `vessels`, `boatName` → `name`, `boatType` → `type`.
  - Booking consumers: `convex/bookings/autoAdvance.ts:177-185` (reads boat resource), `convex/bookings.ts:203, 564` (resource lookup), `convex/bookings/stateMachine.ts:189` (Boat check), `convex/seedBookingData.ts:1085-1087`, `convex/boatWidget.ts`, `convex/demoBookings.ts` — audit for any fleet-path reads.
  - i18n: any key naming `fleet`/`boat` surfaces — check `messages/*.json`.

### P0-12 — Seed Wei Chen teachingLanguages must include `'en'`; happy-path collision handling for seed Wei Chen vs. onboarded Wei Chen

- **Status:** RESOLVED 2026-04-17 — manual-user-creation test plan obviates seed collision. Cascade behavior locked by unit test in `tests/instructors.test.ts`. Seed fix deferred to when `/happypath` automated run resumes.
- **Source:** Stop 4 audit.
- **Impact:** Canonical instructor_3 (`wei-chen`) declares `teachingLanguages_completed: ['zh-CN', 'zh-TW', 'th', 'en']` — seed at `convex/seedInstructorData.ts:58` has `['zh-CN', 'zh-TW', 'th']` (no `'en'`). Happy-path Wei Chen is a freshly-onboarded Clerk user with `teachingLanguages_initial: []` gap; the seeded Wei Chen user (with `tokenIdentifier: seed|wei-chen`) at the same slug blocks fresh onboarding.
- **Action:**
  - Seed extend: add `'en'` to Wei Chen's ROSTER entry (`seedInstructorData.ts:58`) so the seed-hydrated state matches canonical `_completed`.
  - Harness: the happy-path runner must either (a) delete the seeded Wei Chen before onboarding, (b) pick a distinct slug for the happy-path Wei Chen and alias canonical `slugRef`, or (c) document that the happy path resets and re-seeds before each run. Pick one; document in §7.12 or a new §15 "Harness conventions."
  - OPERATOR_PREFERRED check: `convex/seed.ts:467-493` — verify Hug's `preferredInstructorSlugs` includes `'wei-chen'`, `'ryan-clarke'`, and `'li-ming'` (current seed line 469 has `['wei-chen', 'nicole-tam', 'mike-chen', 'xiao-lei', 'zhen-liu']` — missing Ryan + Li Ming). **Committed target (2026-04-14, Cluster B.3):** `preferredInstructorSlugs: ['ryan-clarke', 'wei-chen', 'li-ming']` — Ryan must be #1 so Day 2 zh-TW binding cascades to Wei Chen #2 (proves language-fallback traversal per `assertions.yaml#act_3_phase_1`).
  - Same action for `dive_master` (`arisa-kanchanaburi`): verify DM-eligible preferences; Arisa's seed `['th', 'en']` already matches `_completed` so no seed language extension needed — only harness collision handling.

### P0-13 — `venues.autoAccept` for pool rows — WITHDRAWN

- **Status:** WITHDRAWN 2026-04-17 — see P0-19. Auto-accept is user-level on `stakeholderPreferences.acceptanceMode`. No per-resource column added.

### P0-14 — Seed `NEPTUNE.pool.isAllowed` must be `['z8mv4c']`

- **Source:** Stop 6 audit.
- **Impact:** Canonical `pool_2` declares Neptune's pool private to Neptune-driven bookings. Seed currently omits `isAllowed` (defaults to `[]` open). Seed/canonical drift — without the update, seed-hydrated state allows any operator to attach Neptune's pool, contradicting the happy-path access-control test.
- **Action:** At `convex/seedData.ts:338-349`, add `isAllowed: ['z8mv4c']` to NEPTUNE.pool. Parallel to the existing `NEPTUNE.equipment.isAllowed: ['z8mv4c']` pattern at `convex/seedData.ts:350-358`.

### P0-15 — `customers` table missing `languages` column; portal does not capture customer language

- **Ticket:** `.tickets/DD-485.md`
- **Source:** Stop 8 audit (three-way framing). Canonical `entryCustomer.languages` required (min 1). Convex `customers` table has no `languages` / `language` / `locale` column. Portal 6-step wizard (`src/app/(portal)/portal/[token]/page.tsx` → `portal-active-flow.tsx`) has no language input — contact Step 1 collects name/email/phone/DOB/gender/nationality/passport/emergency but not preferred-communication language.
- **Impact:** Language-matching instructor cascade (Cluster B.3 / `act_3_phase_1`) requires `customer.languages`. Without the column + input, Ryan → Wei Chen fallback cannot fire — the booking picker has no `customer_1.languages = ['zh-TW']` to match against. Language-localized portal chrome (Cluster D.1) also depends on this.
- **Action:**
  - Schema: add `customers.languages: v.array(v.string())` (required, min 1) to `convex/schema.ts` customers table.
  - Mutation: extend `convex/portal*.ts` customer-create + update args.
  - FE: add language-picker field to `src/components/portal/portal-active-flow.tsx` Step 1 Contact (default from browser locale, user-editable). Use native-script labels per `rules/language-picker.md`.
  - Seed: n/a (customers are portal-created, no seed).
  - Booking match: `convex/bookings/*.ts` instructor-cascade must read `customer.languages` and match against `instructor.teachingLanguages`.

### P0-17 — `agents.defaultReferral` vs `stakeholderPreferences.preferredOperatorSlug` semantic alignment

- **Ticket:** `.tickets/DD-487.md`
- **Source:** Stop 9 audit.
- **Impact:** `convex/schema.ts:512` stores `agents.defaultReferral` as a nullable string. `convex/schema.ts:284` stores `stakeholderPreferences.preferredOperatorSlug` as a nullable string on the prefs row. `convex/seed.ts:555-560, 599-601` **copies** `agent.defaultReferral` from seed fixtures INTO `preferredOperatorSlug` at seed time — a one-way snapshot. `agent-profile-form.tsx:195-201` reads `form.defaultReferral` for display ("Bookings cascade from your preferred operator. Change in Preferences → Resources → Operator."). The Preferences editor (`preferences-editor.tsx`) writes `preferredOperatorSlug`. The booking cascade (`use-wizard-preferences.ts:38, 60`) reads `preferredOperatorSlug`. So after an agent edits their preference, `preferredOperatorSlug` moves but `agents.defaultReferral` stays at its initial value — they drift. The agent form still displays the stale `defaultReferral` value as "this is your active referral," which is wrong.
- **Action:**
  - Decide canonical: keep `preferredOperatorSlug` in `stakeholderPreferences` as truth (recommended — it's where edits land, and the cascade reads it) and remove `agents.defaultReferral` column, OR make `agents.defaultReferral` a derived read-through to `preferredOperatorSlug`.
  - Schema change: remove `agents.defaultReferral` from `convex/schema.ts:512`.
  - Mutation change: remove `defaultReferral` from `convex/agents.ts:17, 29` (create + update args).
  - Seed change: drop `defaultReferral` from agent fixtures (`convex/seedData.ts:808, 838, 868, 898`); continue writing `preferredOperatorSlug` to stakeholderPreferences (already wired at `convex/seed.ts:599-601`).
  - FE change: `agent-profile-form.tsx:195-201` reads `form.preferredOperatorSlug` (or the equivalent from the prefs query) instead of `form.defaultReferral`. `profile-shared.ts:34-46, 68-72, 85-90, 93-98` drop `defaultReferral` from `AgentContactFormState`.
  - Canonical update after fix: rename `entryAgent.agents.defaultReferral` → move into a prefs-level block, or keep the canonical name as an abstraction and remap at runtime.
  - Happy-path run: canonical currently carries `agents.defaultReferral: "n7rq5j"` — the referral toggle in Act III.4 must still work post-fix (just reading from the prefs row).

### P0-16 — Portal emergency-contact partial-save path (investigation)

- **Ticket:** `.tickets/DD-486.md`
- **Source:** Stop 8 audit. Canonical `customer_3.customer.emergencyContact_initial: null` declares the deliberate-incomplete pattern — customer submits portal Step 1 without full emergency contact; gap closes before auto-advance to Upcoming. Current portal `step-contact.tsx` lists emergencyContactName/Phone/Relation as required. If Step 1 validation blocks submit without emergency contact, the deliberate-incomplete scenario is not reproducible via UI.
- **Impact:** Act II Phase 3 + gap-close events (`act_2_end.gap_closures`) require the initial submit to succeed with nulls, then re-prompt before Phase II.5 gate. Without a partial-save path, the customer deliberate-incomplete carrier has no reproducible flow.
- **Action:**
  - Investigate: grep `step-contact.tsx` for emergencyContact validators + submit gating. Confirm behavior — does Step 1 Next require all emergencyContact fields?
  - If blocking: decide between (a) relax Step 1 validation to allow null emergency contact + force re-prompt at Step 6 Submit, (b) move emergencyContact to a later step (Step 5 Safety already has bloodType/allergies/medications) so Step 1 can submit without it, (c) change canonical to a different deliberate-incomplete field (e.g., `sizing_initial: null`).
  - If not blocking: document where the partial-save path lives and cite in this P0 as resolved.

### P0-18 — `compressors.gasMixes` non-empty runtime gate

- **Ticket:** `.tickets/DD-488.md`
- **Source:** Retro re-audit Stop 1 (2026-04-14). Canonical `compressor_2.compressors.gasMixes_initial: []` relies on runtime enforcement; schema allows empty array.
- **Impact:** Without a gate, empty-gasMixes compressors surface in the booking picker, contradicting the deliberate-incomplete scenario. Parallel to P0-7 (equipment) / P0-14 (pool).
- **Action:** mutation validator reject empty gasMixes when `profileComplete: true`; cascade helper excludes empty rows; zod tightened; FE Gas Mixes tab hint.

### P0-19 — Auto-accept (WITHDRAWN 2026-04-17)

- **Status:** WITHDRAWN 2026-04-17 — `diveStaff.autoAccept` was added then removed same day. Single source of truth for auto-accept is `stakeholderPreferences.acceptanceMode` (user-level enum: `Auto` / `PrePayRequired` / `PostPayAllowed`), wired at `convex/bookings/create.ts:209`. Seed defaults Instructor role to `PrePayRequired` (manual) and all other roles to `Auto`. Canonical no longer carries per-resource `autoAccept`; the Contact tab has no auto-accept control; the Booking tab's Acceptance Mode radio is the sole surface.
- **Ticket:** `.tickets/DD-489.md` (resolved via removal)
- **Supersedes:** Rule D "all resource rows carry autoAccept with disabled FE checkbox" — see updated choreography.md §II.4.

### P0-20 — `teachingLanguages` empty-array gate on Instructor + DiveMaster

- **Status:** RESOLVED 2026-04-17 — `convex/diveStaff.ts` create/update throw `TEACHING_LANGUAGES_REQUIRED` on empty array. Picker filter (`convex/directory.ts`) excludes empty-language profiles. Zod `min(1)` on client. Tests cover create-reject, update-reject, picker-skip.
- **Ticket:** `.tickets/DD-490.md`
- **Source:** Retro re-audit Stops 4+5. Canonical uses `_initial: []` → `_completed: [...]` pattern for instructor_3 (Wei Chen) + dive_master (Arisa). Schema allows empty array; no picker exclusion guaranteed.
- **Impact:** Happy-path deliberate-incomplete bookability gate relies on this behavior — must be enforced.
- **Action:** mutation validator reject empty on `profileComplete: true`; cascade helper excludes empty rows; zod `.min(1)` for profile-complete state; integration test.

### P0-21 — Pool `confinedCapable` FE conditional-render bug

- **Ticket:** `.tickets/DD-491.md`
- **Source:** Retro re-audit Stop 6. Canonical pool_1–4 all declare `confinedCapable: true`. VenueCapabilities section renders the checkbox ONLY when `venueCategory === 'diveSite'` — pool instances never surface the toggle.
- **Impact:** Operators cannot mark their pool confined-capable; gates OW confined-water sessions per Product Definition §4.
- **Action:** render checkbox for pool (default `true`) + diveSite (current). Keep admin venues seed-managed.

### P0-22 — `hasCompressor` hardcoded in pool + boat payload builders

- **Ticket:** `.tickets/DD-492.md`
- **Source:** Retro re-audit Stops 3+6. Schema has `hasCompressor: v.boolean()` on both `boats` and `venues`; FE hardcodes the value at payload-build time (pool: `false`; boat: `true`). No UI path to correct.
- **Impact:** Operators whose pool has on-site compressor, or whose boat lacks one, cannot reflect reality. Booking logic uses this flag.
- **Action:** decide Option A (expose checkbox), B (derive from vessels), or C (admin-only + remove mutation arg). Recommend A. Default pool `false`, boat `true`.

### P0-23 — `commonLanguageCodes` ghost field in PreferencesEditor

- **Ticket:** `.tickets/DD-493.md`
- **Source:** Retro re-audit cross-cutting. Schema has `stakeholderPreferences.commonLanguageCodes`; form state initializes to `['en']`; upsert mutation accepts. No UI renders it anywhere.
- **Impact:** Dead code OR a missed-implementation spec. Either way, confusing.
- **Action:** trace origin via git blame (per `feedback_trace_before_implement.md`). If orphaned: remove. If deferred: create follow-up ticket.

### P0-24 — `isAllowed` / `notAllowed` access control has no FE input

- **Ticket:** `.tickets/DD-494.md`
- **Source:** Retro re-audit Stops 2–6. Schemas accept both arrays; canonical uses heavily (`equipment_manager_1.isAllowed: ['n7rq5j']`, `pool_2.isAllowed: ['z8mv4c']`). No profile form surfaces either.
- **Impact:** Operators onboarding via UI cannot replicate the canonical access-control pattern — currently seed-only.
- **Action:** Option A (expose FE) via shared `access-control-editor.tsx` across six profile forms, or Option B (admin-only + remove mutation arg). Recommend A for operator autonomy.

### P0-25 — `nitroxCertified` missing from customers + instructors (safety)

- **Status:** PARTIALLY RESOLVED 2026-04-17 — Instructor side closed via derivation: booking gate (`convex/bookings/create.ts` → `assertNitroxCapable` in `convex/lib/diveStaffHelpers.ts`) now reads `credential[].specialtyRatings.includes('Enriched Air')` instead of a standalone boolean. `diveStaff.nitroxCertified` column + Credentials-tab Checkbox were removed same day — the Specialty Instructor Ratings grid already captures nitrox capability per agency. Throws `CAPABILITY_GAP` reason `nitroxRequired` when booking specialty includes `'Enriched Air'` and no credential carries that rating. Customer side (`customers.nitroxCertified` + portal capture) still open — separate follow-up.
- **Ticket:** `.tickets/DD-495.md`
- **Source:** Retro re-audit Stops 2+4. V1 Done Criteria Scene 15 requires visible nitrox cert. No `customers.nitroxCertified` column; `instructors` has `specialtyRatings` (could derive) but no standalone field or UI surface. Booking cascade does not gate nitrox-cylinder assignment on cert status.
- **Impact:** Safety + liability gap — uncertified diver can be booked on a nitrox tank.
- **Action:** add `customers.nitroxCertified` + `instructors.nitroxCertified` (or explicit derivation); portal Step 4/5 captures customer cert; instructor form surfaces state; booking cascade blocks nitrox assignment when cert missing.

### P0-26 — Snapshot field immutability enforcement

- **Ticket:** `.tickets/DD-496.md`
- **Source:** Retro re-audit cross-cutting. `Industry-Alignment-Decisions.md` C1 declares five fields as snapshots: `bookings.operatorName`, `bookings.startDate`, `bookingLinks.customerName`, `bookingLinks.email`, `bookings.endDate`. Schema stores as plain `v.string()`; mutations can overwrite.
- **Impact:** Audit log unreliable; referral return and portal-resent semantics become ambiguous.
- **Action:** add `// snapshot: <description>` comments per `.claude/rules/code-style-nav.md`; add mutation guards that reject patches attempting to overwrite with different values; update `schema-invariants.md` Rule 5 vault doc; integration test per field.

### P0-27 — Per-course-type preference cascade

- **Ticket:** not yet filed (replaces retired DD-317 concept)
- **Source:** Matt's vision 2026-04-14 — "operator has preferred stakeholders ... pre-loaded instructors and boats for a certain type of course (OW vs AOW)." Investigation confirmed flat-list cascade is built (`use-wizard-preferences.ts:23-46`, `itinerary-step.tsx:234-309`) but schema has no `activityType` / `courseCode` key on `stakeholderPreferences`. Current behavior: every course type inherits the same preferred instructor/boat/pool/equipment/compressor.
- **Impact:** Vision's "pre-loaded per course type" requirement cannot be exercised in happypath. Booking for multi-course activity (OW + AOW) cannot route to different instructors per phase.
- **Action:**
  - Schema: add `preferencesByCourseType: v.optional(v.record(courseCode, v.object({instructorSlug: v.optional(...), boatSlug: v.optional(...), poolSlug: v.optional(...), equipmentSlug: v.optional(...), compressorSlug: v.optional(...)})))` on `stakeholderPreferences` table. Flat arrays remain as fallback.
  - Mutation: `stakeholderPreferences.update` accepts the new shape; validation rejects unknown courseCodes.
  - FE: DC + Agent profile Preferences tab adds per-course-type picker (group by course code, per-row resource picks).
  - Cascade: `resolveWizardPreferences` reads course-keyed map first for the current `activityType`, falls back to flat list when no course-specific entry.
  - Cascade trigger: re-resolve on `activityType` change inside booking form.
  - Integration test: DC sets OW→Instructor A + AOW→Instructor B; booking with `activityType=[OW, AOW]` assigns A to OW days + B to AOW days.
- **Depends on:** P0-1 (`submitToDraft` fix) — cascaded picks must persist to reservation writes.
- **Size:** L (schema + mutation + 2 form surfaces + cascade hook + tests).

*(Matt: add additional known blockers below or leave for L.2.)*

---

## 10. Open Questions — Answer-Fillable

**Scope:** cross-cutting design questions Matt fills inline. **Not here:** stop-specific audit questions (those live in §14's per-stop interview state) or architectural tensions (§12).

### Cluster A — Stakeholder Setup

#### A.1 — Exact stakeholder creation order

- **Why it matters:** Determines how many phases Act I has and which stakeholder's login/onboarding the next stop depends on.
- **Claude's recommendation:** Resources first (Instructor ×4 → Boat → Equipment → Pool → Compressor) → DiveCenter "Hug Ocean" (owns its own Pool + Equipment inventory internally) → Agent last. Matches LOCKED 7.2.1 + 7.2.2 and current Fixture.md.
- **Matt's answer:** Compressor ×2 → Equipment Manager → Boat → Instructor → DiveMaster → Pool → DiveCenter → Agent. (Names: §7.12.)
- **Verification layer:** S (profile tables populated), U (onboarding flow complete)

#### A.2 — Exact field checklist per stakeholder role

- **Why it matters:** Without a canonical list, Act I stops cannot declare "onboarding complete." Required fields differ per role.
- **Claude's recommendation:** Use the Convex schema as the source of truth. For each role: required = schema-required + role profile form required props; optional = everything else in the profile form; preferences = `stakeholderPreferences` record for operators, per-role preference object for resources; settings = profile toggles, notification prefs, locale. Derive the checklist from schema at spec promotion time; confirm any specific fields you want explicitly called-out beyond the derivation.
- **Matt's answer:** Every FE/BE field for each in-scope role must have a canonical value in §7.12 Act I — Field ledgers (seed-equivalent instructions; no DB seeds for path actors). §7.12 lists canonical prefill for two compressors and Equipment Manager; Boat, Instructor, DiveMaster, Pool, DiveCenter, Agent still to add.
- **Verification layer:** S (field presence in DB after onboarding completes)

#### A.3 — Which resource roles are truly in scope

- **Why it matters:** Scope of Act I directly. If DiveSite is in scope, DD-366 must unblock first.
- **Claude's recommendation:** In scope for V1: Instructor, Boat, Equipment, Pool, Compressor. Deferred or external-only: DiveSite (DD-366 open), DiveMaster (ratio-matched at booking time, not pre-provisioned — see J.3).
- **Matt's answer:** Resources: Compressor, Equipment Manager, Boat, Instructor, DiveMaster, Pool. Not in path: DiveResort, DiveHostel, Liveaboard.
- **Verification layer:** S, U

#### A.4 — Which operator roles are truly in scope before Agent

- **Why it matters:** V1 scope decision. `WhatAmIDoing.md:60` says DC + Agent only.
- **Claude's recommendation:** DiveCenter only. Liveaboard / DiveResort / DiveHostel deferred to v0.1.1 per `project_v011_scope`.
- **Matt's answer:** Operators: DiveCenter, then Agent.
- **Verification layer:** S (which operator tables are exercised)

---

### Cluster B — Instructor Coverage

> **Answered 2026-04-14 same turn Stop 8 locked.** Committed defaults per Lesson #5. Canonical keys referenced; see `choreography.md` Phase II.4 notes for the full day-to-instructor table and `assertions.yaml#act_2_phase_4` + `act_3_phase_1` for expected state.

#### B.1 — Exact day-to-instructor assignment

- **Why it matters:** Locks the concrete booking itinerary used in Act II. Must exercise all four language-keyed instructors at least once.
- **Claude's recommendation:** O+AP is one booking of ~5 days (OW = 1 confined + 4 open-water; Advanced Plus adds 5 AOW dives, typically days 3–5). Rotate the four in-system instructors across the first four days; reserve Day 5 for external free-text fallback (see B.2). Pick exact per-day assignments in your answer — the constraint is every in-system instructor appears at least once, and day-to-language mapping aligns with the three customers' languages at least once each.
- **Matt's answer:** (committed default, 2026-04-14)
  - **Day 1** (confined + OW dive 1): `canonical.stakeholders.instructor_1` (Ryan Clarke, en/th)
  - **Day 2** (OW dives 2–3): `canonical.stakeholders.instructor_3` (Wei Chen, zh-CN/zh-TW/th/en) — Cluster B.3 cascade target
  - **Day 3** (OW dive 4 + AOW dive 1): `canonical.stakeholders.instructor_2` (Li Ming, zh-CN/en/ko)
  - **Day 4** (AOW dives 2–3): `canonical.stakeholders.dive_master` (Arisa Kanchanaburi, th/en) — exercises DM binding per J.3
  - **Day 5** (AOW dives 4–5): external free-text (Cluster B.2)
- **Verification layer:** M (booking creation with per-day instructor binding), S (Reservation rows per day)

#### B.2 — Exact point where external free-text instructor enters

- **Why it matters:** Tests the free-text fallback code path. Must happen at a deterministic stop.
- **Claude's recommendation:** Day 5 of the O+AP booking — all four in-system instructors unavailable (conflicting schedules, days off, language mismatch). Agent or DC adds external free-text instructor ("Alex Rivera") inline. System accepts and treats as auto-confirmed per V1 Done Scene 2 ("Hand-entered instructor treated as auto-confirmed").
- **Matt's answer:** Accepted — Day 5, free-text "Alex Rivera", auto-confirmed per V1 Done Scene 2. Canonical expresses as `external_free_text` sentinel in `assertions.yaml#act_2_phase_4` (no profile FK).
- **Verification layer:** M (Reservation row has external-instructor flag, no profile FK), U (free-text input accepts name)

#### B.3 — Does the path need to prove language-matching FAILURE before fallback?

- **Why it matters:** Determines whether the spec needs a stop where preferred-instructor language mismatch triggers fallback-down-list.
- **Claude's recommendation:** Yes — once. One booking day has a customer language not matched by the #1 preferred instructor; the cascade falls to the #2 preferred instructor with matching language. Proves both that language match is enforced and that fallback traversal works.
- **Matt's answer:** Accepted — Day 2 binding. `customer_1.languages: ['zh-TW']` ∉ Ryan's `teachingLanguages: ['en','th']`. Hug's `preferredInstructorSlugs = ['ryan-clarke', 'wei-chen', 'li-ming']` (extends P0-12). Cascade Ryan → Wei Chen (has zh-TW) → bind `Reservation.instructorId = wei-chen`. Asserted at `assertions.yaml#act_3_phase_1`.
- **Verification layer:** M (cascade picks #2, not #1), S (Reservation.instructorId = #2)

---

### Cluster C — Invite Delivery

#### C.1 — What counts as successful invite receipt?

- **Why it matters:** Defines when Agent can click Next in Step 1.
- **Claude's recommendation:** Product-surface semantics in V1. Success = (a) `bookingLinks` row exists with correct `channel` (email / whatsapp / line) and `token`, (b) portal URL resolves when opened in a browser, (c) channel-specific deep-link URL is well-formed (`mailto:`, `https://wa.me/...`, `https://line.me/R/...`). True outbound delivery proof deferred to DD-362 in `HappyPath.md` Phase 4.
- **Matt's answer:** _(blank)_
- **Verification layer:** S (`bookingLinks` row shape), M (link-generation mutation), U (button renders correct deep-link href)

#### C.2 — Is link generation enough, or must true outbound delivery be proven?

- **Why it matters:** Huge implementation cost difference. Outbound delivery requires Resend + WhatsApp Business API + LINE Official API.
- **Claude's recommendation:** Link generation only in V1. Outbound delivery is Phase 4 concern (DD-362). The happy path documents the gap but does not block on it.
- **Matt's answer:** _(blank)_
- **Verification layer:** same as C.1

#### C.3 — All three channels: real delivery or product-surface?

- **Why it matters:** See C.1 / C.2 tradeoff.
- **Claude's recommendation:** Product-surface for all three in V1. Email may additionally run through Resend in dev (already wired). WhatsApp + LINE stay deep-link-only. Real delivery on all three is a post-V1 hardening pass.
- **Matt's answer:** _(blank)_
- **Verification layer:** S + M

---

### Cluster D — Portal and Localization

#### D.1 — What exactly must localize by customer language?

- **Why it matters:** Scope of localization effort per portal stop.
- **Claude's recommendation:** Full portal chrome + form labels + validation messages + transactional emails localize to customer language. Defaults (units, date format, phone format) localize to region. Legal waiver text stays in English with translation hint — PADI standard is English-canonical.
- **Matt's answer:** _(blank)_
- **Verification layer:** U (rendered in correct language), M (email subject/body localized)

#### D.2 — Full portal chrome, only defaults, or both?

- **Why it matters:** Scope of localization effort.
- **Claude's recommendation:** Both. Portal chrome localizes via next-intl; defaults localize via browser locale + user preference. Skeleton originally framed these as alternatives — they are complementary.
- **Matt's answer:** _(blank)_
- **Verification layer:** same as D.1

#### D.3 — Does later language change trigger reassignment behavior inside the happy path?

- **Why it matters:** If customer updates their language in portal Step 1, should the auto-filled instructor re-match?
- **Claude's recommendation:** No language-change reassignment in V1. Instructor binding happens at booking-creation time, not at portal-update time. If customer's portal-declared language differs from originally-captured language, flag via notification but do not reassign instructor. Can live in Act IV as a branch probe, not Act II canonical.
- **Matt's answer:** _(blank)_
- **Verification layer:** M (no cascade re-run on portal submit)

---

### Cluster E — Referral / Preference Shift

#### E.1 — Which exact fields must visibly change when referral is toggled on?

- **Why it matters:** Without a list, "referral-switch test" is vague and unverifiable.
- **Claude's recommendation:** Fields that switch preference source: instructor (with language match), boat, pool, equipment manager, compressor, auto-accept behavior, calendar visibility (agent becomes read-only observer, DC becomes owner). Fields that do NOT change: customer list, date range, activity selection.
- **Matt's answer:** _(blank)_
- **Verification layer:** M (toggling referral updates preference-source bindings), U (form re-renders with new defaults)

#### E.2 — Replace already-selected values immediately, or only fill empty slots?

- **Why it matters:** Determines whether agent's prior selections are destroyed when referral toggles on mid-booking.
- **Claude's recommendation:** Replace all preference-driven fields. Referral-on means "use the target operator's preferences" — allowing agent's prior selections to survive creates a hybrid that tests nothing clean. Customer data, dates, activities are preserved (not preference-driven).
- **Matt's answer:** _(blank)_
- **Verification layer:** M (post-toggle state has operator's preferences), U (confirmation toast if values were replaced)

#### E.3 — Contradiction between preferred-operator prefill and referral-toggle timing?

- **Why it matters:** Agent's profile has a "preferred operator" field. If referral is off by default but agent has a preferred operator, does preferred-operator prefill already happen?
- **Claude's recommendation:** Yes, a tension exists. Current schema: `agents.preferredOperatorSlug` is independent of the `referral` checkbox on the booking form. If referral is off, agent's own preferences drive; if on, the preferred operator's preferences drive. The preferred-operator field itself does nothing unless referral is toggled on. **Resolution:** surface a hint on the booking form when referral is off and preferred-operator set ("Toggle referral to use your preferred operator's preferences"). Leaves default-off policy intact but makes the path discoverable.
- **Matt's answer:** _(blank)_
- **Verification layer:** U (hint renders when referral off + preferred-operator set)

---

### Cluster F — Visibility / Acceptance / Convergence

#### F.1 — When does each stakeholder first see the booking?

- **Why it matters:** Without a timeline, it's unclear which dashboard the next stop pivots to.
- **Claude's recommendation:** At Draft creation. Booking is "live from creation" per V1 Done Scene 2. All assigned stakeholders see the booking on their dashboards immediately: urgent treatment (red/orange) for manual-accept pending reservations; normal treatment for self-owned or auto-accepted reservations; full booking detail visible to everyone (no filtered views per V1 Done Cross-Cutting Rules).
- **Matt's answer:** _(blank)_
- **Verification layer:** M (all Reservations created at Draft), U (all dashboards show booking)

#### F.2 — Which stakeholders are auto-accept vs manual-accept in the canonical path?

- **Why it matters:** Determines which stops are "auto-confirmed" vs "require acceptance click."
- **Claude's recommendation:**
  - Auto-accept (self-owned): Pool (DC owns), Equipment (DC owns)
  - Auto-accept (preferred with auto-accept ON): Compressor Shop Chalong Pier
  - Manual-accept: Instructor (Wei Chen has manual-accept per current fixture; should be exercised)
  - Auto-confirmed (hand-entered): free-text external instructor per V1 Done Scene 2
- **Matt's answer:** _(blank)_
- **Verification layer:** M (Reservation.status at creation), U (Pending Request UI visible / absent)

#### F.3 — What combination of manual + automatic confirmations gives strongest coverage?

- **Why it matters:** Act II spine needs a deterministic sequence that exercises every acceptance pathway at least once.
- **Claude's recommendation:** Across the days of the O+AP booking, mix: (i) self-owned auto-accept (Pool, Equipment), (ii) preferred-with-auto-accept-ON (Compressor), (iii) preferred-with-manual-accept (Instructor Wei Chen Day 1), (iv) different-instructor-with-auto-accept-ON (Day 2), (v) free-text external (Day 5). Covers 5 distinct acceptance codepaths without requiring a second booking.
- **Matt's answer:** _(blank)_
- **Verification layer:** M (covering 4+ distinct confirmation codepaths)

---

### Cluster G — Reminder Logic

#### G.1 — What exact reminder sequence should the canonical path prove?

- **Why it matters:** "Reminders fire" is untestable without a sequence.
- **Claude's recommendation:** Four reminder events:
  1. **Portal-link reminder** — fires when customer has not opened portal within 24h of invite send. Same channel as original invite.
  2. **Incomplete-portal reminder** — fires at 8pm booking-local-time day before activity if portal not submitted.
  3. **Day-before logistics message** — fires at 8pm booking-local-time day before activity (may coincide with #2) with pickup times, vague-by-design location detail. Includes account-creation prompt #2.
  4. **Post-trip message** — fires at 8pm booking-local-time on last dive day. Includes review prompt + account-creation prompt #3.
- **Matt's answer:** _(blank)_
- **Verification layer:** M (cron / scheduled action fires with correct payload), U (reminder received on customer side)

#### G.2 — Reminders use original operator-selected channel, or later customer-declared contact method?

- **Why it matters:** Design ambiguity. Customer may change contact preferences during portal.
- **Claude's recommendation:** Use the most-recent customer-declared contact method if it exists, else the original invite channel. Customer edits their contact method in Portal Step 1. If customer says "email me" in portal but invite was WhatsApp, reminders switch to email. If customer never edits, reminders use invite channel.
- **Matt's answer:** _(blank)_
- **Verification layer:** M (reminder payload routes to current contact method)

#### G.3 — How long should the booking intentionally remain incomplete before reminders fire?

- **Why it matters:** Dev run duration and timer deterministic-firing strategy depend on this.
- **Claude's recommendation:** Use a dev-only "fire now" endpoint to trigger each reminder at a stop boundary. Wall-clock sleep is not practical; mock clock is reliable but complex; fire-now endpoint is fastest to build and keeps the spec deterministic. Production uses real cron; dev uses fire-now.
- **Matt's answer:** _(blank)_
- **Verification layer:** M (fire-now trigger produces same payload as cron). Ticket: file fire-now endpoint separately.

---

### Cluster H — Medical / Blocking Behavior

#### H.1 — Should the canonical happy path remain medically clean?

- **Why it matters:** Medical block interrupts convergence. Either every customer passes, or one blocks and unblocks.
- **Claude's recommendation:** Yes — clean in Act II canonical. Act II proves convergence on the default path. Medical block-and-lift lives in Act IV as a Branch Probe (H.2).
- **Matt's answer:** _(blank)_
- **Verification layer:** M (no medical block flags on any Reservation), U (portal Medical step shows "no" throughout)

#### H.2 — Should one customer trigger a block and later unblock?

- **Why it matters:** Coverage decision.
- **Claude's recommendation:** Yes — in Act IV. One customer triggers Tier 1 medical block → DD generates PDF package → DC uploads signed physician clearance → DC lifts block → convergence resumes. Exercises V1 Done Scene 6 while rejoining canonical spine.
- **Matt's answer:** _(blank)_
- **Verification layer:** M (medical state transitions clean → blocked → clean), U (block screen, upload flow, lift button)

#### H.3 — Medical-block coverage inline or separate branch file?

- **Why it matters:** Spec-document structure.
- **Claude's recommendation:** Inline as Act IV Branch Probe. Medical block that RESOLVES rejoins convergence; keeping it in-spec ensures the resolution path is exercised. Terminating medical block (physician declines clearance → booking cancelled) becomes a separate spec file — out of happy path.
- **Matt's answer:** _(blank)_
- **Verification layer:** structural

---

### Cluster I — Post-Trip Conversion

#### I.1 — What exact "remaining account information" fields are part of conversion?

- **Why it matters:** "Finish account info" is underspecified.
- **Claude's recommendation:** Portal collects: name, email, phone, language, passport/ID, emergency contact, medical history, waiver signature, equipment sizing, safety info. Clerk account needs: Clerk ID (auto), email (prefilled), password, 2FA optional. Delta to finish post-trip: password + optional 2FA + opt-in to marketing/review follow-ups.
- **Matt's answer:** _(blank)_
- **Verification layer:** S (`users` + `userRoles` rows created), U (signup form prefilled)

#### I.2 — Is prefilled-signup arrival enough, or must full account creation complete?

- **Why it matters:** End-of-path criterion.
- **Claude's recommendation:** Full account creation must complete for at least one customer. Prefilled signup is halfway; without the user hitting Submit, we have not proven the account-conversion code path. Propose: Customer 1 completes account creation; Customer 2 arrives at prefilled signup but does not submit (proves surface renders); Customer 3 dismisses prompt (proves dismissal path).
- **Matt's answer:** _(blank)_
- **Verification layer:** S (at least one `users` row created post-booking), U (three distinct behaviors observable)

#### I.3 — Should the happy path prove first repeat-use behavior after conversion?

- **Why it matters:** "Future reuse/prefill benefits" is locked (7.11) but untestable unless exercised.
- **Claude's recommendation:** Yes, briefly. After Customer 1 creates their account, they log in and attempt to book another activity (via public surface if one exists, or by accepting a future DC-created invite using their account). Verify medical + waiver prefill from prior booking. Thin proof but essential — locks in the value of the account.
- **Matt's answer:** _(blank)_
- **Verification layer:** M (prior portal data surfaces in new portal), U (prefill observable)

---

### Cluster J — Framing and Scope (new meta-questions)

#### J.1 — Unified happy path as one doc, or multiple?

- **Why it matters:** Determines whether the skeleton becomes one exhaustive spec or branches into files.
- **Claude's recommendation:** Resolved in this session: one unified doc covering Acts I–V, with unhappy-path terminators (TTL expiry, no-show, date blocking, boat cancellation with no rebook) as separately-linked spec files that reference the happy path as their divergence point.
- **Matt's answer:** _(blank — confirm or adjust)_
- **Verification layer:** structural

#### J.2 — MVP role scope confirmation

- **Why it matters:** Downstream scope of Act I Onboarding.
- **Claude's recommendation:** DiveCenter + Agent only as operator roles. Liveaboard / DiveResort / DiveHostel deferred per `WhatAmIDoing.md:60`. Resource roles per A.3.
- **Matt's answer:** _(blank)_
- **Verification layer:** S (which tables exercised)

#### J.3 — DiveMaster coverage

- **Why it matters:** DM reservation path exists in schema; untested means untrusted.
- **Claude's recommendation:** No pre-provisioned DM in Act I. Exercise one DM binding in Act III. One day of the O+AP booking requires a DM due to ratio rules. DM is assigned via DC preferences or manually added as free text if no preferred DM set. Covers the DM reservation row without adding an Act I phase.
- **Matt's answer:** _(blank)_
- **Verification layer:** M (Reservation row with `role='DiveMaster'`), S (diveMaster profile FK or null if free-text)

#### J.4 — DiveSite account creation in V1

- **Why it matters:** DD-366 is open.
- **Claude's recommendation:** External-only (free-text) DiveSite in V1. DD-366 stays open; real DiveSite account flow deferred to v0.1.1. Happy path references a dive site by free-text name + coordinates only. Matches current `Stops.md` treatment of venue resources.
- **Matt's answer:** _(blank)_
- **Verification layer:** S (no diveSites table required for happy path)

#### J.5 — 8pm anchor time semantics

- **Why it matters:** Reminder timing deterministic firing in dev.
- **Claude's recommendation:** Booking-location timezone (not user timezone, not UTC). 8pm in the location where the dive happens. Dev implementation: dev-only "fire now" endpoint bypasses wall clock; production cron evaluates `scheduledAt` against location tz.
- **Matt's answer:** _(blank)_
- **Verification layer:** S (scheduled actions have timezone field), M (fire-now endpoint triggers correctly)

#### J.6 — Account-creation prompt wording reconciliation

- **Why it matters:** Skeleton 7.11 and V1 Done Scenes 4+5 use slightly different phrasing for the three prompts.
- **Claude's recommendation:** Byte-identical phrasing, chosen once and locked. Example set:
  1. After portal submission: "Create an account to save your dive history."
  2. 8pm day before activity: "Your dive is tomorrow. Create an account to see logistics in one place."
  3. Post-completion with review prompt: "Your dive is complete. Create an account to leave a review and save your history."
  Or whatever wording you prefer — key is a single canonical English source per i18n rule, all five locales derived from it.
- **Matt's answer:** _(blank)_
- **Verification layer:** U (prompt strings render identically across locales via next-intl)

#### J.7 — Branching policy (unhappy paths inline vs separate)

- **Why it matters:** Spec structure.
- **Claude's recommendation:** Rejoin branches inline as Act IV probes (medical block-and-lift, decline-and-reassign, language-fallback-after-mismatch). Terminator branches as separate spec files (TTL expiry, no-show, date blocking, boat cancellation with no rebook). Each terminator spec references the happy path as its divergence point.
- **Matt's answer:** _(blank)_
- **Verification layer:** structural

---

### Cluster K — Testability (verification layer detail)

#### K.1 — Accept / reject / restructure the Acts partition?

- **Why it matters:** Act structure shapes every stop's position.
- **Claude's recommendation:** Accept — Acts I–V as described in §8.
- **Matt's answer:** _(blank)_
- **Verification layer:** structural

#### K.2 — Minimum verification layer per Act

- **Why it matters:** Declares what's required before a stop is "done."
- **Claude's recommendation:**
  - Act I (Onboarding): S + U minimum. Mutation layer optional — convex-test already covers profile writes.
  - Act II (Convergence): S + M + U. All three layers required. This is the spine.
  - Act III (Variation Matrix): M minimum + U for surfaces that differ. Schema layer inherited from Act II.
  - Act IV (Branch Probes): S + M minimum. UI layer if the branch surfaces novel UI.
  - Act V (Post-Trip Conversion): S + U. Mutation layer for any account-creation mutation.
- **Matt's answer:** _(blank)_
- **Verification layer:** meta

#### K.3 — Invariant probe points — which stops verify which LAW?

- **Why it matters:** The 3 LAW invariants need explicit verification hooks.
- **Claude's recommendation:**
  - **LAW 1 (no exclusive dual-hold):** proved in Act III when a second booking attempts to grab Wei Chen on an already-held day. Must reject. Stop name: "Double-hold guard."
  - **LAW 2 (pooled decrement, zero-block):** proved in Act II when equipment rental count decrements on customer portal submit; proved to block in Act IV with a pooled-inventory exhaustion scenario.
  - **LAW 3 (same-mutation snapshot atomicity):** proved in Act II at `submitToDraft`. Test asserts Reservation row + AvailabilitySnapshot updated in same mutation txn. Prerequisite: fix submitToDraft first per P0-1.
- **Matt's answer:** _(blank)_
- **Verification layer:** M (invariant assertion in convex-test)

---

### Cluster L — Live Blockers

#### L.1 — P0 reservation-write bug ticket

- **Why it matters:** Act II spine cannot run until `submitToDraft` writes all four reservations (instructor, pool, equipment, compressor).
- **Claude's recommendation:** File as `DD-<next>` with:
  - Title: "submitToDraft writes only instructor reservation — pool/equipment/compressor missing"
  - Priority: P0
  - Acceptance: after submit, `reservations` table contains 4 rows (instructor, pool, equipment, compressor) with correct status per preference auto-accept.
  - Size: M (pending investigation of `convex/bookings/create.ts`)
- **Matt's answer:** _(blank — accept and file, or adjust)_
- **Verification layer:** S + M

#### L.2 — Other known blockers surfaced by HappyPath.md gap list

- **Why it matters:** Surface explicitly before the spec is authored.
- **Claude's recommendation:** Named candidates from `HappyPath.md` gap list:
  - DD-353 (customer contact drops at submit — persistence gap)
  - DD-354 (SendPortalLink dead code — not wired)
  - DD-314 (3-channel deep-link send — not built)
  - ~~DD-317 (referral loads operator prefs — not built)~~ **RETIRED 2026-04-14** — cascade verified built at `src/lib/hooks/use-wizard-preferences.ts:23-46` + `src/components/booking/itinerary-step.tsx:234-309` + `convex/bookingDraftMutations.ts:79-91`. Flat-preference cascade works; referral toggle flips source correctly. Integration test coverage happens via happypath run itself. See P0-27 for the real gap (per-course-type cascade).
  - DD-363, DD-364 (post-trip landing, account conversion — not built)

  Act II cannot run without DD-353 and DD-354 at minimum. Act V cannot run without DD-363 / DD-364. File each as explicit prerequisite or confirm already-tracked.
- **Matt's answer:** _(blank — list any not yet addressed, or add new blockers observed)_
- **Verification layer:** varies per ticket

---

## 11. Claude's Recommendations (commentary)

**Scope:** Claude's opinions on spec direction and cross-cutting decisions. Defeasible — not locks. **Not here:** audit-process lessons (§14) or known tensions (§12). When a stop locks DONE in §14, harmonize any stale recommendation in this section the same turn.

Read alongside your answers.

1. **Split intent achieved.** Skeleton is the contemplation brief; executable specs go to `Vaults/DiveDispatch/wiki/Plans/happy-path-*.md` once locked.
2. **Cite V1 Done Scenes per stop.** When promoting locked answers into executable form, every stop's action cites which V1 Scene it validates.
3. **Land the Draft → Upcoming fix first** (P0-1).
4. **Keep current `Stops.md` as smoke test.** The zero-seed full happy path is additive, not a replacement.
5. **Anchor on LAW invariants.** Each inventory-writing stop carries an `Invariant:` block naming which LAW. See K.3.
6. **Separate unhappy-path terminators** — J.7.
7. **Reconcile account-prompt wording once and lock** — J.6.
8. **Dev-env reminder strategy = fire-now endpoint** — G.3 / J.5.

## 12. Known Implementation Tensions

**Scope:** architectural or product-design tensions between spec intent and code reality. **Not here:** behavioral anti-patterns (§13) or audit-process mistakes (§14 lessons).

Preserved from the original brief:

1. Product intent and implementation are not identical.
2. Some reminder and messaging behaviors are specified in docs but only partially implemented (DD-362, DD-354, DD-363).
3. Referral and preference-cascade behavior is wired end-to-end for flat preferences (see retired DD-317 note in §10 L.2). Per-course-type cascade is not built — see P0-27.
4. Existing walkthrough observations show a booking can appear healthy while still missing required reservation writes (`Observations.md:8–14`).
5. Post-trip conversion is conceptually richer in the docs than in clearly finished UX.

## 13. Anti-Patterns for the Next LLM

**Scope:** behavioral/interpretive mistakes a future LLM might make reading this spec. **Not here:** audit-process lessons (§14 lessons — those capture mistakes already made during the in-progress audit).

Do not:
- reduce this to "make one booking succeed quickly"
- assume seed-data shortcuts are acceptable replacements
- assume every LOCKED item is already implemented in code
- collapse stakeholder setup into a trivial prerequisite
- confuse this contemplation brief with `/happypath` execution stops
- propose code changes based on this doc alone — promote to executable spec first

## 14. Resume Point — Happy-Path Stakeholder Field Audit

**Scope:** audit-process state and per-stop interview queue. **Not here:** spec-level recommendations (§11) or behavioral anti-patterns (§13).

**Last session:** 2026-04-14.

**State at handoff:** Stops 1–6 + `admin_venues.kata_beach` locked in `canonical.json`. §9 holds P0-1 through P0-14. §14 is the resume pointer; joint ledger per Lesson #1 is: `skeleton.md` + `canonical.json` + `canonical.schema.json` + `choreography.md` + `assertions.yaml` (see [`INDEX.md`](./INDEX.md)). Three stops remain: Stop 7 (DiveCenter), Stop 8 (Customer — lighter portal template), Stop 9 (Agent — renumbered from old Stop 10; Stop 10 deleted). DC / Customer / Agent placeholder entries already in `canonical.json` with `_pending` markers — replace in place when the stop locks.

**Retroactive re-audit owed on Stops 1–6:** previous audits used `convex/schema.ts` as the yardstick (schema-driven). New framing is three-way: canonical intent ∪ schema ∪ FE. Fields silently omitted as "schema-optional" may be canonical-required (e.g., `confinedCapable` on pools, now added). Re-audit surfaces any missed canonical values as new P0s.

### Audit structure

Stakeholder audit stops split into three layers (see §0 Glossary for full definitions):

- **Resource stakeholders (Stops 1–6)** — Compressor, Equipment Manager, Boat, Instructor, DiveMaster, Pool. Independent; don't cross-reference each other except via multi-role users sharing rows (Lesson #9).
- **Customer (Stop 8)** — bookee. Lighter audit template — portal fixture fields + one deliberate-incomplete pair. No userRoles row, no autoAccept, no isAllowed.
- **Operator stakeholders (Stops 7, 9)** — DiveCenter, Agent. Orchestrate bookings; depend on resource stakeholders. Agent additionally depends on DiveCenter (referral functionality). **Ordering:** resources (1–6) → customer (8) → operators (7 DC, 9 Agent) — operators last because they depend on resources; Agent last within operators because it depends on DC. Operator role subsumed by DiveCenter — no separate Operator stop.
- **Admin (admin_venues)** — pre-seeded venues with no owner. **Kata Beach is the sufficient single exemplar** — more admin venues can be added post-audit without reopening.

### Lessons carried forward (read before resuming)

These rules fire from mistakes already made this audit. Do not relearn.

1. **The joint ledger is: `skeleton.md` + `canonical.json` + `canonical.schema.json` + `choreography.md` + `assertions.yaml`.** Nothing in `.claude/plans/`. Nothing in `Vaults/DiveDispatch/wiki/Plans/`. See [`INDEX.md`](./INDEX.md) routing table for what belongs where. Plan files created by plan mode are harness artifacts; migrate content out immediately and delete. Historical mistake: Stops 1 + 2 canonical drifted into a plan file while skeleton stayed stale for 2 rounds — two files of truth always drift.

2. **Orient to the whole app once, not stop-by-stop.** Before Stop 1, read in parallel: `convex/schema.ts` (all 39 tables), `convex/seedData.ts` (every seed fixture), `src/components/profiles/*.tsx` (every role form), `src/components/account/profile-basic-info.tsx` (shared Profile-tab primitives), `src/lib/constants/roles.ts` (tab config). This catches (a) multi-role users like `HUG_OCEAN` (DC+Boat+Pool+Equipment) and `NICOLE_DC` (DC+Equipment) — same user across multiple stop entries, not separate stakeholders; (b) shared primitives already shipped (firstName/lastName/nickname/DOB/appLanguage) so they don't get false-flagged; (c) helper builders like `buildNicoleInventoryOverrides()` that encode inventory generation patterns. Narrow per-stop Explore agents missed all three categories and produced false blockers.

3. **Verify FE presence before flagging a gap.** For every "not in UI" / "not wired" claim, grep across `src/components/profiles/**`, `src/components/account/**`, `convex/http.ts`, `convex/lib/**` before promoting to blocker. A gap retractable by one grep is a discipline failure. Provenance: Stop 1 false-flagged `customerLanguages` on DC/Agent (already at `dive-center-profile-form.tsx` + `agent-profile-form.tsx`) and Clerk `firstName`/`lastName` bridge (already at `convex/http.ts`).

4. **Seed is canonical — not skeleton's pre-existing JSON.** When seed and skeleton §7.12 disagree, seed wins. Skeleton had invented data like "Ta Revolution" (last name), `appLanguage: 'en'` for Thai operators, and 5-gear-type manufacturer lists. Seed had Anong Petcharat, `th`, and 2-3-type manufacturer lists. Seed is the production-ready truth; skeleton pre-existing JSON was a guess.

5. **Don't ask stupid questions. Commit to reasonable defaults and let Matt correct.** Matt has interrupted to say this. When proposing values, commit with seed + production-realistic defaults; surface only the decisions that are not inferable. Multi-option A/B/C interviews are for interview mode on real ambiguity (business rules, policy), not on "which brand" or "how many sizes." **Every open question in this skeleton must carry a committed default** — none remain bare.

6. **Deliberate-incomplete rule is universal — one user per role carries a gap.** Every stakeholder type must have exactly one user with an intentional missing/empty field that renders them unbookable until the walkthrough fills it. Convention: shadow fields `<field>_initial` (seeded gap state) + `<field>_completed` (target state after walkthrough). Picker / completeness gate / inventory-availability gate must exclude the incomplete user until the gap closes. See §7.12 header table for per-role assignments. If a role has only one happy-path user (e.g. Pool with just Hug's pool), either add a second user to carry the gap or mark that role exempt with explicit justification.

7. **`isAllowed` / `notAllowed` is role-specific, not universal.** Compressor defers to future version. Equipment actively uses it (Hug's boat + equipment are private to Hug-driven bookings via `isAllowed: ['n7rq5j']`). Check the seed for each role before assuming.

8. **Auto-accept = row-level boolean + disabled FE checkbox, except Instructor.** Applies to Compressor (P0-3), Equipment (P0-6), Boat (P0-9), Pool, DiveMaster. **Instructor is the exception** — toggleable, enabled (not disabled). DC + Agent are organizers, no auto-accept column. Field always `true` server-side in V1 for the disabled-checkbox roles; Instructor value is user-controlled. Audit each upcoming stop for column presence on the role's table.

9. **Multi-role users share one `users` row, N role profiles.** `HUG_OCEAN` user `Somchai Prasert` (slug n7rq5j) owns `diveCenters`, `boats`, `venues` (pool), `equipment` rows simultaneously. Canonical JSON for each stop references the same user via `slugRef` — not a separate user block per stop. Don't duplicate user data across stops; reference the shared row.

10. **Admin-added venues live outside `stakeholders`.** Some venues exist as booking-form location references without any owning stakeholder — admin pre-seeds them. Pattern: `venues.userId` omitted, `inventoryUnits.ownerId: '__unowned__'`, `ownerType: 'DiveSite'`. Canonical home is the `admin_venues` sibling of `stakeholders` in §7.12. Kata Beach is the seed reference (see `convex/seedData.ts`, `convex/seed.ts`). Admin venues have no onboarding stop, are exempt from the deliberate-incomplete rule, and ship `verified: true` (admin pre-approves).

### Progress snapshot

| Stop | Category | Role | Status | Canonical in §7.12 | Blockers in §9 | §11 rec |
|---|---|---|---|---|---|---|
| 1 | Resource | Compressor ×2 | DONE (retro-patched 2026-04-14 — +P0-18 gasMixes gate) | compressor_1 (Scuba Market), compressor_2 (Chalong Pier, gasMixes-gap) | P0-2, P0-3, P0-4, P0-5, P0-18 (5) | harmonized |
| 2 | Resource | Equipment Manager ×3 | DONE (retro-patched 2026-04-14 — +P0-24 isAllowed FE, +P0-25 nitroxCertified) | equipment_manager_1 (Hug), equipment_manager_2 (Scuba Revolution), equipment_manager_3 (Nicole — mask-empty) | P0-6, P0-7, P0-8, P0-24, P0-25 (5) | harmonized |
| 3 | Resource | Boat ×2 | DONE (retro-patched 2026-04-14 — +P0-22 hasCompressor, +P0-24 isAllowed FE) | boat_1 (Hug, M.V. Hug Ocean), boat_2 (PHUKET_DC, MQ5+MQ7) | P0-9, P0-10, P0-11, P0-22, P0-24 (5) | harmonized |
| 4 | Resource | Instructor ×4 | DONE (retro-patched 2026-04-14; Stop 5 absorbed 2026-04-17 post DM-user-role collapse) | instructor_1 (Ryan), instructor_2 (Li Ming), instructor_3 (Wei Chen, teachingLanguages-gap), instructor_4 (Arisa, PADI DM credential, teachingLanguages-gap) | P0-12 ✓, P0-19 ✓, P0-20 ✓, P0-24, P0-25 ✓ (5) | harmonized |
| 5 | Resource | (merged into Stop 4) | MERGED 2026-04-17 — DM collapsed to credential-level on Instructor role. Arisa moved to Stop 4 as instructor_4. | — | — | — |
| 6 | Resource | Pool ×4 | DONE (retro-patched 2026-04-14 — +P0-21 confinedCapable FE, +P0-22 hasCompressor, +P0-24 isAllowed FE) | pool_1 (Hug), pool_2 (Neptune isAllowed), pool_3 (Water Pro maxCapacity-gap), pool_4 (Shark Bites) | P0-13, P0-14, P0-21, P0-22, P0-24 (5) | harmonized |
| admin | Admin | AdminVenue | DONE (Kata Beach = single sufficient exemplar) | `admin_venues.kata_beach` | none | harmonized |
| 7 | Operator | DiveCenter | DONE | dive_center_1 (Hug Ocean, slug n7rq5j), dive_center_2 (Nicole Dive Center, slug q9bz7r, associations-gap) | none (no new three-way gaps) | harmonized |
| 8 | Customer | Customer | DONE | customer_1 (Mei-Ling Chen, zh-TW), customer_2 (Jun Wang, zh-CN, medical-block), customer_3 (James Thompson, en, emergencyContact-gap) | P0-15, P0-16 (2) | harmonized (Cluster B.1/B.2/B.3 answered) |
| 9 | Operator | Agent | DONE | agent (Alex Walker, fresh-signup, defaultReferral → dive_center_1 via n7rq5j) | P0-17 (1) | harmonized |
| — | Cross-cutting | Act II spine (submitToDraft bug) | OPEN | n/a (bug, not ledger entry) | P0-1 (1) | — |

**§11 harmonization rule:** when a stop locks DONE, update its §11 recommendation status the same turn. The "§11 rec" column flips `pending` → `harmonized` as part of the same-turn discipline.

### Pre-run blocker gate

**All P0s in §9 must close before the happy-path run can execute.** Filing rule: when a stop locks DONE, file its P0s to `.tickets/DD-*.md` via `/board` the same turn. Don't batch to audit end; don't defer.

Batching for reference:
- Stop 1 (Compressor): P0-2, P0-3, P0-4, P0-5, P0-18 (gasMixes non-empty gate)
- Stop 2 (Equipment): P0-6, P0-7, P0-8, P0-24 (isAllowed FE), P0-25 (nitroxCertified safety)
- Stop 3 (Boat): P0-9, P0-10, P0-11, P0-22 (hasCompressor FE), P0-24 (isAllowed FE)
- Stop 4 (Instructor): P0-12, P0-19 (autoAccept), P0-20 (teachingLanguages gate), P0-24 (isAllowed FE), P0-25 (nitroxCertified)
- Stop 5 (DiveMaster): P0-12, P0-19 (autoAccept), P0-20 (teachingLanguages gate)
- Stop 6 (Pool): P0-13, P0-14, P0-21 (confinedCapable FE), P0-22 (hasCompressor FE), P0-24 (isAllowed FE)
- Stop 7 (DiveCenter): none (dive_center_1/2 locked without new gaps)
- Stop 8 (Customer): P0-15 (customers.languages schema + portal gap), P0-16 (emergencyContact partial-save investigation)
- Stop 9 (Agent): P0-17 (agents.defaultReferral vs preferredOperatorSlug denormalization)
- Cross-cutting: P0-1 (`submitToDraft` bug, Act II spine), P0-23 (commonLanguageCodes ghost field), P0-26 (snapshot immutability enforcement)

**Total §9 count: 26 P0s** (P0-1 through P0-26). All filed to `.tickets/DD-*.md`: DD-457…DD-464 (legacy subset; most remaining are un-ticketed legacy per project memory), DD-485 (P0-15), DD-486 (P0-16), DD-487 (P0-17), DD-488 (P0-18), DD-489 (P0-19), DD-490 (P0-20), DD-491 (P0-21), DD-492 (P0-22), DD-493 (P0-23), DD-494 (P0-24), DD-495 (P0-25), DD-496 (P0-26). P0-1 through P0-14 still need ticket filing — queue for next session or backfill via `/board create` before /happypath run.

### Per-stop validation checklist (five-file touch)

Before flipping a stop's status to DONE, verify — all five files update in the same turn:

1. **`canonical.json`** — stakeholder entry written; `_pending` placeholder removed. `ajv validate -s canonical.schema.json -d canonical.json` passes.
2. **`canonical.schema.json`** — if the entry type needs a new shape (new role concept, new field), update here first.
3. **`choreography.md`** — Act I / II / III / IV / V phase table references the new canonical key(s); flow steps added if the stop changes the run shape.
4. **`assertions.yaml`** — relevant `act_N_phase_M` entries updated to reference the new canonical keys and expected state.
5. **`skeleton.md`** — §9 blockers filed (new P0s from schema/FE gaps uncovered) + §14 progress row flipped to DONE + §11 harmonization + `/board` files P0 tickets to `.tickets/`.

Additional per-entry checks (enforced by schema where possible):

- Every `<field>_initial` has a matching `<field>_completed`.
- Every `slugRef` points to a stakeholder id that exists in `canonical.json`.
- Seed values cited match current `convex/seedData.ts` (Lesson #4).
- Three-way field audit: every canonical field verified against convex schema (P0 if missing/wrong) AND FE form (P0 if missing).

### Next-stop staging rule

Only **one stop's interview state** is queued in §14 at a time. When the queued stop locks DONE, overwrite its interview-state block with the next unlocked stop's in the same turn. **All stops 1–9 + admin venues now locked. The next queue entry is the retro re-audit of Stops 1–6.**

### Audit COMPLETE (2026-04-14)

All stakeholder ledger stops locked:

- **Stops 1–6 (Resources) + admin_venues.kata_beach** — previously locked; retro-patched 2026-04-14 under three-way framing. 9 new P0s filed (P0-18 through P0-26). Canonical patch: `autoAccept` added to `instructor_1/_2/_3.instructors` + `dive_master.diveMasters` per Lesson #8; canonical schema `entryDiveMaster.diveMasters.autoAccept: const true` added.
- **Stop 7 DiveCenter** — `dive_center_1` (Hug Ocean, n7rq5j), `dive_center_2` (Nicole Dive Center, q9bz7r). No new P0s.
- **Stop 8 Customer** — `customer_1/_2/_3` (Mei-Ling / Jun / James). Cluster B.1/B.2/B.3 answered; migrated to `choreography.md` Phase II.4 notes. New P0s: P0-15, P0-16.
- **Stop 9 Agent** — `agent` (Alex Walker, defaultReferral → dive_center_1). New P0: P0-17.

§9 P0 count: **P0-1 through P0-26 (26 total)**. Pre-run gate still blocking — all 26 must close before `/happypath` can fire. Retirement criteria (INDEX.md + §16): audit COMPLETE ✓ · one fully green happy-path run ✗ · V1 shipped ✗. Artifact set retires when all three hold.

### 2026-04-18 extension — Stop 2 Gear overlay ready for walkthrough

The Equipment Manager profile completed a structural collapse + matrix UI build in two sessions after audit lock:

- **2026-04-17 equipment-gear-consolidation** (commits `81203c3c`, `08ea8e74`, `c1f992d3`) — `profileTabs` went `[contact, gear-catalog, inventory, booking]` → `[contact, gear, booking]`. Gear tab is overlay-only (`src/components/inventory/connected-equipment-gear.tsx`). `equipmentGearCatalogSchema` Zod deleted. `manufacturersByGearType` derived from `equipmentInventory` rows (P0-7 → DERIVED). Equipment readiness now gated on per-gear-type inventory completeness.
- **2026-04-18 gear-matrix-section** (commits `2b1f80f1`, `264188fe`) — Per-manufacturer gear matrix UI (wetsuit/bcd/fins rendered as size × totalUnits grid; mask/regulator stay on list shape). New `bulkSetByManufacturer` mutation: diff-based single-write that creates/patches/deletes `equipmentInventory` rows to match submitted cells. Fin `sizeSystem` discriminator added (`eu | us | cm | letter`) + 4 per-system size tables + `isMatrixGearType()` type predicate. New components: `gear-matrix-section.tsx`, `add-gear-manufacturer-dialog.tsx`.

Stop 2 is **walkthrough-ready** at the code/test layer (5001/5001, tsc clean, /gate CLEAN 2026-04-18). UX confirmation still owed — Matt's hand-created-persona walkthrough (below) is the verification.

### Next queue — P0 closure, then /happypath run

**Scope:** work through the 26-entry §9 queue. Land each fix via `/post-spec DD-NNN` (or picked from `/board`). When §9 empties, the happy-path run (via `/happypath` skill) becomes eligible.

**Ticket coverage:** P0-15 through P0-26 have tickets DD-485 through DD-496. **P0-1 through P0-14 still need backfill into `.tickets/DD-*.md`** before `/post-spec` can consume them — either `/board create` each, or open §9 in reverse order and skip-to-ticketed (start with P0-18+). Document backfill status here when complete.

**Resume instructions for the next session:**

1. Read this section first.
2. Either: (a) backfill P0-1…P0-14 as tickets via `/board create` so `/post-spec` can consume; OR (b) start with DD-485+ (P0-15+) and come back to P0-1…P0-14 later.
3. Pick a ticket, execute `/post-spec DD-NNN`. Fix land, ticket moves to done. §9 count decrements.
4. When §9 empty, run `/happypath`. Follow §15 Execution Conventions. Paused findings route to `Vaults/DiveDispatch/HappyPath/Observations.md` per §15 rule 3.
5. On first fully green run + V1 ship, invoke retirement: move `ultraplan/*` to `ultraplan/archive/<date>/`, promote spec into `Vaults/DiveDispatch/HappyPath/Stops.md` + `Fixture.md`, delete HANDOFF.

### For the next LLM — context handoff summary

You inherit a **stakeholder field audit at COMPLETE status**. All 9 stops + admin_venues locked; 26 P0s in §9; 12 ticketed (DD-485..DD-496). Next work is P0 closure via `/post-spec`, then `/happypath` run.

Read `ultraplan/INDEX.md` for routing; §9 for open blockers (fix these); §14 above for current progress. Follow the 10 lessons — especially #1 (five-file ledger only), #4 (seed wins), #5 (commit defaults on every open Q), #9 (slugRef for multi-role), #10 (admin venues outside stakeholders).

## 15. Execution Conventions

**Scope:** rules that apply to the happy-path *run* itself. **Not here:** audit-time rules (those live in §14).

1. **Pause on every UI page before clicking "next."** The LLM driving the run stops at each page, wizard step, portal screen, and modal to let Matt voice concerns before proceeding. Never auto-advance. Applies end-to-end from sign-in through Draft → Upcoming transition.

2. **Every run writes to `Vaults/DiveDispatch/HappyPath/Runs/<timestamp>.md`.** One file per run. Captures which Acts ran green, which paused, and every finding encountered during execution. Runs/ is the source of truth for what happened; Observations.md is the deduplicated rolling view.

3. **Post-run observation routing.** After a run completes (or aborts):
   - `/happypath` appends new findings to `Vaults/DiveDispatch/HappyPath/Observations.md`.
   - For each **new** observation (not a repeat):
     - If the finding is an audit-derived mistake (e.g., canonical ledger drift, missing field in §7.12): log to §14 "testing fallout" (conversation-level; see §14 resume instructions).
     - If the finding is a code-level blocker for the run (bug, missing feature, schema gap): promote to a **new P0-N entry in §9** the same turn. Pre-run blocker gate then governs when the next run can fire.
     - If the finding is neither (a race condition seen once, UI copy, transient env issue): leave in Observations.md as `Open` with `seen: 1`; promote only if it recurs.
   - Repeat observations: `/happypath` bumps `seen:` counter. Promotion threshold: `seen ≥ 3` or any observation that blocks run progression = auto-promote to §9.

4. **No run fires while §9 P0s are open.** Enforced manually by the operator invoking `/happypath`. The runner should list open P0s at launch and refuse to proceed until Matt overrides with explicit flag.

(Future execution-time rules land here as they surface during runs.)

## 16. Meta — Cadence, Ownership, Environment, Retirement

**Scope:** operational questions about this document and the run it feeds. **Not here:** technical execution (§15), audit state (§14), or spec recommendations (§11).

### Cadence

- **V1 launch gate:** the happy-path run must complete green once before V1 ships. This is the primary use.
- **Ongoing:** fire on-demand whenever a PR touches core booking flow, reservation mutations, portal code, or stakeholder onboarding. Not nightly — too expensive for a manual, paused run.
- **Regression baseline:** once V1 ships, expectation is at least one clean run per release-candidate cut.

### Ownership

- **Run driver:** Claude, via `/happypath` skill. Matt observes, voices concerns during paused pages (§15 rule 1).
- **Audit ledger (§14 + §7.12):** Claude writes; Matt reviews locks before they commit.
- **Blocker triage (§9):** Claude promotes from Observations.md per §15 rule 3; Matt approves P0 severity.
- **Ticket filing:** Claude, via `/board`, same turn a stop locks (per §14 resume rule).

### Environmental prerequisites

- Clerk dev instance synced with users (see `/clerk-signin` skill — handles sign-in automatically).
- Convex dev deployment up with current schema.
- Dev server running (`/clerk-signin` auto-starts if not up).
- Seed data loaded — but **only for non-path actors** per §5 Scope. Happy-path stakeholders are created via UI during Act I.
- Playwright MCP browser available for the run itself.

### Between-run reset

- Path actors (every user in §7.12) must not exist at run start. Zero-pre-state rule (§4).
- Reset procedure: `npm run seed:force` resets non-path actors; happy-path fixture actors are never seeded and must not persist between runs. If leftover path-actor rows are detected at run start, abort the run and purge before proceeding.
- `Fixture.md` values are re-used across runs — byte-identical inputs (§15 rule 2 implicit).

### Document retirement

This skeleton retires when **all three** are true:
1. Audit is `COMPLETE` (every row in §14 progress snapshot is DONE, §9 at final count).
2. Happy-path has completed one fully green run (no paused findings, no Observation escalations).
3. V1 has shipped.

Retirement action: move the file to `Vaults/DiveDispatch/Archive/happy-path-spec-skeleton-<date>.md`. The permanent spec successor is the locked content in `Vaults/DiveDispatch/HappyPath/Stops.md` + the `Fixture.md` + the canonical entries preserved in the Archive copy. §7.12 canonical values migrate to production seed where appropriate.
