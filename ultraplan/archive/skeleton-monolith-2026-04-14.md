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

- **Resuming an audit session?** Jump to §14 Resume Point.
- **Looking for canonical stakeholder data?** Jump directly to §7.12 Field Ledgers (inside §7, marked ACTIVE). LIVE ledger — edit in place.
- **Filing a blocker?** §9 Prerequisites.
- **Running the happy-path?** §15 Execution Conventions + `Vaults/DiveDispatch/HappyPath/Stops.md` (executable spec).
- **Understanding scope/authorities?** §1–§6.
- **Reconciling conflicting advice?** §10 (global open Qs) · §11 (Claude's recommendations) · §12 (tensions) · §13 (anti-patterns) · §14 lessons (audit-process). Each section's preamble declares what belongs there.
- **Meta (cadence, ownership, reset, retirement)?** §16 Meta.

### Data flow

```
Audit (§14) ─────────────► Canonical ledger (§7.12, ACTIVE)
                                       │
                                       ├─► Fixture.md (run inputs, byte-identical)
                                       └─► Expected state assertions (post-run)

Stops.md (walkthrough spec, executable)
    ▼
/happypath runner ──────► (pauses at every UI page — §15 Execution Conventions)
    ▼
Observations.md (rolling log) ──► §9 Prerequisites / §14 fallout ──► gates next run
```

§7.12 produces two artifacts: **Fixture.md** (what gets typed into the UI) and **expected-state assertions** (what the DB should look like after each Act). Stops.md is the orthogonal executable spec for the run itself. Observations from each run feed §9 blockers or §14 fallout, which gate the next run (pre-run blocker gate, §14).

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
| Resource stakeholder (Stops 1–6) | `id`, `role`, `user` or `slugRef`, role-specific schema fields, `autoAccept: true` (except Instructor — toggleable), `isAllowed`/`notAllowed` if role-applicable, `<field>_initial` + `<field>_completed` pair if carrying the deliberate-incomplete gap | **S + U** (field presence in DB after onboarding + UI creation flow completes) | Per Lesson #8. Instructor is the only resource without the auto-accept disabled pattern. |
| Customer (Stop 8) | `id`, portal fixture fields (firstName, lastName, email, phone, DOB, certLevel, medical y/n, emergencyContact, languages), one `<field>_initial` + `<field>_completed` pair | **S + M + U** (portal token valid, mutation accepts partial progress, UI submits) | No userRoles row, no autoAccept, no isAllowed. Lighter template. |
| Operator stakeholder (Stops 7, 9) | `id`, `role`, `user` or `slugRef`, organizer schema fields, `isAllowed`/`notAllowed`, `customerLanguages`, deliberate-incomplete pair | **S + U** (organizer profile persists, UI flows complete) | No `autoAccept` column. Agent additionally carries `defaultReferral` or equivalent. |
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

```json
{
  "order": [
    "compressor_1",
    "compressor_2",
    "equipment_manager_1",
    "equipment_manager_2",
    "equipment_manager_3",
    "boat_1",
    "boat_2",
    "instructor_1",
    "instructor_2",
    "instructor_3",
    "dive_master",
    "pool_1",
    "pool_2",
    "pool_3",
    "pool_4",
    "dive_center",
    "agent"
  ],
  "stakeholders": {
    "compressor_1": {
      "role": "Compressor",
      "users": {
        "email": "scuba-market+clerk_test@divedispatch.dev",
        "name": "Prawit Suksawat",
        "firstName": "Prawit",
        "lastName": "Suksawat",
        "businessName": "Scuba Market Thailand",
        "appLanguage": "th",
        "phone": "+66-76-330-345",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "compressors": {
        "name": "Scuba Market Thailand",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8202,
        "lng": 98.3062,
        "email": "scuba-market@divedispatch.dev",
        "phone": "+66-76-330-345",
        "gasMixes": ["air", "nitrox"],
        "nitroxO2Percent": 32,
        "autoAccept": true,
        "verified": false
      }
    },
    "compressor_2": {
      "role": "Compressor",
      "note": "Deliberate-incomplete per rule: starts with empty gasMixes → cannot fulfill tank fills → booking picker excludes. Happy-path scene walks gas-mix-add before this compressor becomes selectable.",
      "users": {
        "email": "compressor-chalong+clerk_test@divedispatch.dev",
        "name": "Sombat Charoensuk",
        "firstName": "Sombat",
        "lastName": "Charoensuk",
        "businessName": "Compressor Shop Chalong Pier",
        "appLanguage": "th",
        "phone": "+66-81-234-5014",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "compressors": {
        "name": "Compressor Shop Chalong Pier",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8386,
        "lng": 98.3519,
        "email": "compressor-chalong@divedispatch.dev",
        "phone": "+66-76-395-001",
        "gasMixes_initial": [],
        "gasMixes_completed": ["air", "nitrox"],
        "nitroxO2Percent": 32,
        "autoAccept": true,
        "verified": false
      }
    },
    "equipment_manager_1": {
      "role": "Equipment",
      "slugRef": "n7rq5j",
      "note": "Hug Ocean internal equipment; shared user with DC/Pool/Boat roles. Private to Hug-driven bookings via isAllowed.",
      "users": {
        "email": "hug-ocean+clerk_test@divedispatch.dev",
        "name": "Somchai Prasert",
        "firstName": "Somchai",
        "lastName": "Prasert",
        "businessName": "Hug Ocean",
        "appLanguage": "zh-CN",
        "phone": "+66-81-234-5001",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "equipment": {
        "name": "Hug Ocean",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8804,
        "lng": 98.3923,
        "email": "hug-ocean@divedispatch.dev",
        "phone": "+66-76-381-103",
        "manufacturersByGearType": {
          "wetsuit": ["ScubaPro", "Aqua Lung", "Mares"],
          "bcd": ["ScubaPro", "Aqua Lung", "Mares"],
          "regulator": ["ScubaPro", "Aqua Lung", "Mares"]
        },
        "isAllowed": ["n7rq5j"],
        "autoAccept": true,
        "verified": false
      },
      "inventoryOverrides": "[30 SKUs @ totalUnits=4 each: wetsuit 3 brands × 4 sizes; bcd 3 brands × 3 sizes; fins 5 sizes (no brand); mask 1 regular (no brand); regulator 3 brands (no size). 4-customer capacity.]"
    },
    "equipment_manager_2": {
      "role": "Equipment",
      "slugRef": "v8sr2p",
      "note": "Scuba Revolution Phuket — external equipment rental; open access. Nicknamed 'Ta'.",
      "users": {
        "email": "scuba-revolution+clerk_test@divedispatch.dev",
        "name": "Anong Petcharat",
        "firstName": "Anong",
        "lastName": "Petcharat",
        "nickname": "Ta",
        "businessName": "Scuba Revolution Phuket",
        "appLanguage": "th",
        "phone": "+66-76-330-678",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "equipment": {
        "name": "Scuba Revolution Phuket",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8207,
        "lng": 98.3425,
        "email": "scuba-revolution@divedispatch.dev",
        "phone": "+66-76-330-678",
        "manufacturersByGearType": {
          "wetsuit": ["ScubaPro", "Aqua Lung", "Mares"],
          "bcd": ["ScubaPro", "Aqua Lung", "Mares"],
          "regulator": ["ScubaPro", "Aqua Lung", "Mares"]
        },
        "isAllowed": [],
        "autoAccept": true,
        "verified": false
      },
      "inventoryOverrides": "[Same 30-SKU spread as equipment_manager_1 @ 4-customer capacity.]"
    },
    "equipment_manager_3": {
      "role": "Equipment",
      "slugRef": "q9bz7r",
      "note": "Nicole Dive Center — external; shared user with DC role (see dive_center canonical for Stop 7). Starts deliberately incomplete: ZERO mask SKUs. Happy-path scene walks mask-inventory add before she becomes selectable in bookings.",
      "users": {
        "email": "nicole-dive-center+clerk_test@divedispatch.dev",
        "name": "Nicole Huang",
        "firstName": "Nicole",
        "lastName": "Huang",
        "businessName": "Nicole Dive Center",
        "appLanguage": "zh-TW",
        "phone": "+66-81-234-5004",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "equipment": {
        "name": "Nicole Dive Center",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8804,
        "lng": 98.3923,
        "email": "nicole-dive-center@divedispatch.dev",
        "phone": "+66-76-386-002",
        "manufacturersByGearType": {
          "wetsuit": ["ScubaPro", "Aqua Lung", "Mares"],
          "bcd": ["ScubaPro", "Aqua Lung", "Mares"],
          "regulator": ["ScubaPro", "Aqua Lung", "Mares"]
        },
        "isAllowed": [],
        "autoAccept": true,
        "verified": false
      },
      "inventoryOverrides_initial": "[29 SKUs @ totalUnits=4 each: wetsuit/bcd/regulator brand matrix + fins 5 sizes. NO mask SKUs — intentional gap.]",
      "inventoryOverrides_completed": "[Add 1 mask SKU @ totalUnits=4 to reach parity with equipment_manager_1 and equipment_manager_2.]"
    },
    "boat_1": {
      "role": "Boat",
      "slugRef": "n7rq5j",
      "boats": {
        "name": "M.V. Hug Ocean",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8804,
        "lng": 98.3923,
        "email": "hug-ocean@divedispatch.dev",
        "phone": "+66-76-381-101",
        "vessels": [
          {
            "name": "M.V. Hug Ocean",
            "maxPax": 50,
            "type": "day_boat",
            "routes": [{ "diveSite": "Racha Noi / Racha Yai", "daysOfWeek": [1, 2, 3, 4, 5, 6, 0] }]
          }
        ],
        "hasCompressor": true,
        "isAllowed": [],
        "notAllowed": [],
        "autoAccept": true,
        "verified": false
      }
    },
    "boat_2": {
      "role": "Boat",
      "slugRef": "p5ky3w",
      "note": "Deliberate-incomplete per rule: starts with zero vessels (empty fleet). Happy-path scene walks vessel-add before booking-picker surfaces PHUKET_DC as a selectable boat.",
      "users": {
        "email": "phuket-dive-center+clerk_test@divedispatch.dev",
        "name": "Kittisak Charoen",
        "firstName": "Kittisak",
        "lastName": "Charoen",
        "businessName": "Phuket Dive Center",
        "appLanguage": "th",
        "phone": "+66-81-234-5003",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "boats": {
        "name": "Mandarin Queen",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8804,
        "lng": 98.3923,
        "email": "phuket-dive-center@divedispatch.dev",
        "phone": "+66-76-385-002",
        "vessels_initial": [],
        "vessels_completed": [
          {
            "name": "M.V. Mandarin Queen 5",
            "maxPax": 70,
            "type": "day_boat",
            "routes": [
              { "diveSite": "Racha Noi / Racha Yai", "daysOfWeek": [1, 4, 6] },
              { "diveSite": "Shark Point / King Cruiser", "daysOfWeek": [2] },
              { "diveSite": "Phi Phi", "daysOfWeek": [3, 5, 0] }
            ]
          },
          {
            "name": "M.V. Mandarin Queen 7",
            "maxPax": 90,
            "type": "day_boat",
            "routes": [
              { "diveSite": "Racha Noi / Racha Yai", "daysOfWeek": [2, 5, 0] },
              { "diveSite": "Shark Point / King Cruiser", "daysOfWeek": [3] },
              { "diveSite": "Phi Phi", "daysOfWeek": [1, 4, 6] }
            ]
          }
        ],
        "hasCompressor": true,
        "isAllowed": [],
        "notAllowed": [],
        "autoAccept": true,
        "verified": false
      }
    },
    "instructor_1": {
      "role": "Instructor",
      "slugRef": "ryan-clarke",
      "label": "English + Thai",
      "users": {
        "email": "ryan-clarke+clerk_test@divedispatch.dev",
        "name": "Ryan Clarke",
        "firstName": "Ryan",
        "lastName": "Clarke",
        "businessName": "Ryan Clarke",
        "appLanguage": "en",
        "phone": "+66-81-600-1000",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "instructors": {
        "name": "Ryan Clarke",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8804,
        "lng": 98.3923,
        "email": "ryan-clarke+clerk_test@divedispatch.dev",
        "phone": "+66-81-600-1000",
        "credential": [
          {
            "agency": "PADI",
            "level": "OWSI",
            "agencyID": "PADI-300000",
            "specialtyRatings": ["Deep", "Navigation"]
          }
        ],
        "teachingLanguages": ["en", "th"],
        "isAllowed": [],
        "notAllowed": [],
        "verified": false
      }
    },
    "instructor_2": {
      "role": "Instructor",
      "slugRef": "li-ming",
      "label": "English + Simplified Chinese + Korean",
      "users": {
        "email": "li-ming+clerk_test@divedispatch.dev",
        "name": "Li Ming",
        "firstName": "Li",
        "lastName": "Ming",
        "businessName": "Li Ming",
        "appLanguage": "en",
        "phone": "+66-81-603-1003",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "instructors": {
        "name": "Li Ming",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8804,
        "lng": 98.3923,
        "email": "li-ming+clerk_test@divedispatch.dev",
        "phone": "+66-81-603-1003",
        "credential": [
          {
            "agency": "SSI",
            "level": "OWI",
            "agencyID": "SSI-500030",
            "specialtyRatings": ["Deep"]
          }
        ],
        "teachingLanguages": ["zh-CN", "en", "ko"],
        "isAllowed": [],
        "notAllowed": [],
        "verified": false
      }
    },
    "instructor_3": {
      "role": "Instructor",
      "slugRef": "wei-chen",
      "label": "Simplified + Traditional Chinese + Thai + English (seed needs +en — P0-12)",
      "note": "Deliberate-incomplete per rule: starts with teachingLanguages_initial: [] — unbookable until languages added. Walkthrough exercises instructor-picker language filter + profile-complete gate.",
      "users": {
        "email": "wei-chen+clerk_test@divedispatch.dev",
        "name": "Wei Chen",
        "firstName": "Wei",
        "lastName": "Chen",
        "businessName": "Wei Chen",
        "appLanguage": "en",
        "phone": "+66-81-602-1002",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "instructors": {
        "name": "Wei Chen",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8804,
        "lng": 98.3923,
        "email": "wei-chen+clerk_test@divedispatch.dev",
        "phone": "+66-81-602-1002",
        "credential": [
          {
            "agency": "PADI",
            "level": "MSDT",
            "agencyID": "PADI-300020",
            "specialtyRatings": ["Deep", "Enriched Air", "Wreck", "Navigation", "Night"]
          }
        ],
        "teachingLanguages_initial": [],
        "teachingLanguages_completed": ["zh-CN", "zh-TW", "th", "en"],
        "isAllowed": [],
        "notAllowed": [],
        "verified": false
      }
    },
    "dive_master": {
      "role": "DiveMaster",
      "slugRef": "arisa-kanchanaburi",
      "note": "Deliberate-incomplete per rule: starts with teachingLanguages_initial: [] — unbookable until languages added. Parallel to instructor_3 gap pattern.",
      "users": {
        "email": "arisa-kanchanaburi+clerk_test@divedispatch.dev",
        "name": "Arisa Kanchanaburi",
        "firstName": "Arisa",
        "lastName": "Kanchanaburi",
        "businessName": "Arisa Kanchanaburi",
        "appLanguage": "en",
        "phone": "+66-81-615-1015",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "diveMasters": {
        "name": "Arisa Kanchanaburi",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8804,
        "lng": 98.3923,
        "email": "arisa-kanchanaburi+clerk_test@divedispatch.dev",
        "phone": "+66-81-615-1015",
        "credential": [
          {
            "agency": "PADI",
            "level": "Divemaster",
            "agencyID": "PADI-300150"
          }
        ],
        "teachingLanguages_initial": [],
        "teachingLanguages_completed": ["th", "en"],
        "isAllowed": [],
        "notAllowed": [],
        "verified": false
      }
    },
    "pool_1": {
      "role": "Pool",
      "slugRef": "n7rq5j",
      "venues": {
        "name": "Hug Ocean",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8804,
        "lng": 98.3923,
        "email": "hug-ocean@divedispatch.dev",
        "phone": "+66-76-381-102",
        "venueCategory": "pool",
        "hasCompressor": false,
        "maxDepth": 3,
        "maxCapacity": 15,
        "isAllowed": [],
        "notAllowed": [],
        "autoAccept": true,
        "verified": false
      }
    },
    "pool_2": {
      "role": "Pool",
      "slugRef": "z8mv4c",
      "note": "Neptune's pool — private to Neptune-driven bookings via isAllowed. Shared user with Neptune DC + Equipment (first appearance of Neptune in §7.12; Stops 7/9 reference via slugRef).",
      "users": {
        "email": "neptune+clerk_test@divedispatch.dev",
        "name": "Wei Lin",
        "firstName": "Wei",
        "lastName": "Lin",
        "businessName": "Neptune",
        "appLanguage": "zh-CN",
        "phone": "+66-81-234-5002",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "venues": {
        "name": "Neptune",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8804,
        "lng": 98.3923,
        "email": "neptune@divedispatch.dev",
        "phone": "+66-76-383-002",
        "venueCategory": "pool",
        "hasCompressor": false,
        "maxDepth": 2.5,
        "maxCapacity": 6,
        "isAllowed": ["z8mv4c"],
        "notAllowed": [],
        "autoAccept": true,
        "verified": false
      }
    },
    "pool_3": {
      "role": "Pool",
      "slugRef": "b3wt9f",
      "note": "Deliberate-incomplete per rule: starts with maxCapacity_initial: 0 — zero bookable seats → picker excludes. Walkthrough exercises capacity-add to 25.",
      "users": {
        "email": "water-pro+clerk_test@divedispatch.dev",
        "name": "Niran Jantarakul",
        "firstName": "Niran",
        "lastName": "Jantarakul",
        "businessName": "Water Pro",
        "appLanguage": "th",
        "phone": "+66-76-394-001",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "venues": {
        "name": "Water Pro",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8804,
        "lng": 98.3923,
        "email": "water-pro@divedispatch.dev",
        "phone": "+66-76-394-001",
        "venueCategory": "pool",
        "hasCompressor": false,
        "maxDepth": 2.5,
        "maxCapacity_initial": 0,
        "maxCapacity_completed": 25,
        "isAllowed": [],
        "notAllowed": [],
        "autoAccept": true,
        "verified": false
      }
    },
    "pool_4": {
      "role": "Pool",
      "slugRef": "g2hn6x",
      "users": {
        "email": "shark-bites+clerk_test@divedispatch.dev",
        "name": "Kittisak Wongsawat",
        "firstName": "Kittisak",
        "lastName": "Wongsawat",
        "businessName": "Shark Bites",
        "appLanguage": "th",
        "phone": "+66-76-394-002",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "venues": {
        "name": "Shark Bites",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8804,
        "lng": 98.3923,
        "email": "shark-bites@divedispatch.dev",
        "phone": "+66-76-394-002",
        "venueCategory": "pool",
        "hasCompressor": false,
        "maxDepth": 2.5,
        "maxCapacity": 8,
        "isAllowed": [],
        "notAllowed": [],
        "autoAccept": true,
        "verified": false
      }
    },
    "dive_center": {
      "role": "DiveCenter",
      "users": {
        "email": "owner@hugocean.example",
        "name": "Patong Owner",
        "firstName": "Patong",
        "lastName": "Owner",
        "businessName": "Hug Ocean Dive Center",
        "appLanguage": "en",
        "customerLanguages": ["en", "th", "zh-CN"],
        "phone": "+66 76 111 2222",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "diveCenters": {
        "name": "Hug Ocean",
        "placeName": "Patong Beach, Phuket",
        "country": "Thailand",
        "lat": 7.896,
        "lng": 98.298,
        "email": "owner@hugocean.example",
        "phone": "+66 76 111 2222",
        "associations": [
          {
            "agency": "PADI",
            "number": "PAD-DC-90001",
            "owDays": 4,
            "aowDays": 2,
            "oaDays": 5,
            "selectedSpecialties": ["Deep", "Night", "Navigation", "Peak", "Wreck"]
          }
        ],
        "customerLanguages": ["en", "th", "zh-CN"],
        "isAllowed": [],
        "notAllowed": [],
        "verified": true
      }
    },
    "agent": {
      "role": "Agent",
      "users": {
        "email": "agent.walker@phukettravel.example",
        "name": "Alex Walker",
        "firstName": "Alex",
        "lastName": "Walker",
        "businessName": "Alex Walker",
        "appLanguage": "en",
        "customerLanguages": ["en"],
        "phone": "+66 81 900 1234",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "agents": {
        "name": "Alex Walker",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.88,
        "lng": 98.39,
        "email": "agent.walker@phukettravel.example",
        "phone": "+66 81 900 1234",
        "associations": [{ "agency": "PADI", "number": "PAD-AG-70001" }],
        "defaultReferral": "hug-ocean-slug",
        "isAllowed": [],
        "notAllowed": [],
        "verified": true
      }
    }
  },
  "admin_venues": {
    "kata_beach": {
      "category": "AdminVenue",
      "note": "Admin-added venue — no stakeholder user signs in. Pre-seeded via UNOWNED_DIVE_SITES at convex/seedData.ts:1075-1077 and convex/seed.ts:419-441. venues.userId is omitted (schema v.optional allows); inventoryUnits uses sentinel ownerId '__unowned__' / ownerType 'DiveSite'. DiveSite stakeholder role is v0.1.1 defer — this row is a booking-form location reference only, not an operator-run resource.",
      "venues": {
        "name": "Kata Beach",
        "placeName": "Phuket",
        "country": "Thailand",
        "lat": 7.8206,
        "lng": 98.3003,
        "venueCategory": "diveSite",
        "diveSiteTypes": ["shore"],
        "confinedCapable": true,
        "hasCompressor": false,
        "maxCapacity": 50,
        "isAllowed": [],
        "notAllowed": [],
        "verified": true
      },
      "inventoryUnits": {
        "resourceType": "DiveSite",
        "resourceId": "kata-beach",
        "displayName": "Kata Beach",
        "capacityModel": "Pooled",
        "totalUnits": 50,
        "ownerId": "__unowned__",
        "ownerType": "DiveSite"
      }
    }
  }
}
```

**Admin-add convention:** `admin_venues` is a sibling of `stakeholders` — entries have no user, no onboarding stop, no `userId` on `venues`, and use sentinel `ownerId: '__unowned__'` + `ownerType: 'DiveSite'` on `inventoryUnits`. Admin pre-seeds these before Stop 1 begins. Happy-path booking forms reference them as selectable dive-site options.

**Resume:** Act I canonical stakeholder JSON above is the single source for prefilled onboarding; align UI steps and DB assertions to these values (adjust emails slugs when wiring to real Clerk/Convex ids).

---

## 8. Proposed Acts partition

Five Acts partition the run. Each Act has numbered sub-phases. Every inventory-writing phase carries an `Invariant:` annotation naming the LAW exercised (per §11 rec #5). Every phase declares its minimum verification layer (§2 S/M/U framework). Every phase cites which Scene(s) from `V1 Done Criteria.md` it validates (per §11 rec #2).

Scene citations are short-form: `Scene N` per `Vaults/DiveDispatch/Product/V1 Done Criteria.md`. LAW references are LAW 1/2/3 per §3.

### Act I — Onboarding (Stakeholder Creation)

Each resource + operator stakeholder logs in, completes onboarding, verifies persistence. One sub-phase per §14 audit stop. Customer is not onboarded here (joins via portal in Act II). Admin venues are pre-seeded (no phase).

| Phase | Stop | Min layer | Scene | Invariant |
|---|---|---|---|---|
| I.1 | Compressor (×2) | S + U | Scene 15 | none (no inventory write) |
| I.2 | Equipment Manager (×3) | S + U | Scene 14 | none |
| I.3 | Boat (×2) | S + U | — | none |
| I.4 | Instructor (×3) | S + U | Scene 13 | none |
| I.5 | DiveMaster | S + U | — | none |
| I.6 | Pool (×4) | S + U | — | none |
| I.7 | DiveCenter (×2) | S + U | **Scene 1** | none |
| I.8 | Agent | S + U | — | none |

**End-of-Act assertion:** every §7.12 canonical user has a persisted `users` row + N role rows per Lesson #9; every resource row carries `autoAccept: true` (Instructor toggleable); every deliberate-incomplete pair still shows `_initial` state (`_completed` lands in Act II / III).

### Act II — Booking Convergence (Canonical Spine)

| Phase | Action | Min layer | Scene | Invariant |
|---|---|---|---|---|
| II.1 | Agent (or DC) drags O+AP quick-book onto calendar → booking in `Draft` | S + M | **Scene 2** | none |
| II.2 | `submitToDraft` writes instructor + pool + equipment + compressor reservations atomically with AvailabilitySnapshot | S + M | **Scene 2** | **LAW 3** (same-mutation snapshot atomicity). Currently broken — see **P0-1**. |
| II.3 | Portal link generated → customer opens → completes medical + waiver + sizing + emergency contact | S + M + U | **Scene 3** | none (portal does not write inventory) |
| II.4 | Resource-side confirmations cascade (auto-accept for Compressor / Equipment / Boat / Pool / DiveMaster; manual accept for Instructor) | S + M | Scene 2 + Scene 7 (decline branch) | **LAW 1** (exclusive-unit: instructor cannot double-hold); **LAW 2** (pooled: pool/equipment count decrements; blocks only at zero) |
| II.5 | Booking auto-advances Draft → Upcoming → Active → Completed as gates fire | S + M | **Scene 4** | **LAW 3** (snapshot atomicity on state transitions) |
| II.6 | Dive day opens → check-in → activity completes | S + M + U | **Scene 5** | none |

**End-of-Act assertion:** booking status = `Completed`; reservations table has one row per resource per day; no `AvailabilitySnapshot` drift; every `_initial` gap on a user touched by the booking has closed to `_completed`.

### Act III — Variation Matrix

Same booking shape as Act II, exercised across variation axes. Each axis is independent and must hold.

| Phase | Variation | Min layer | Scene | Invariant |
|---|---|---|---|---|
| III.1 | Customer-language fallback (preferred instructor language mismatch → cascade to #2 in ordered preference) | M | Cross-Cutting | **LAW 1** (#2 instructor's exclusive slot holds) |
| III.2 | Channel variation (email vs WhatsApp vs SMS for portal invite) | M + U | Cross-Cutting | none |
| III.3 | Partial portal progress → reminder fires → resume from last-completed step | M + U | **Scene 3** | none |
| III.4 | Referral toggle mid-booking (agent creates, flips to referred DC → ownership + visibility re-compute) | S + M | **Scene 12** | none |

### Act IV — Branch Probes (in-spec unhappy paths that rejoin)

| Phase | Branch | Min layer | Scene | Invariant |
|---|---|---|---|---|
| IV.1 | Medical hard block → operator contacts → resolve → resume | M + U | **Scene 6** | none (medical does not touch inventory) |
| IV.2 | Resource decline → cascade down preference list → re-assign → rejoin spine | S + M | **Scene 7** | **LAW 1** (reassigned instructor's exclusive slot transitions cleanly); **LAW 2** (pooled decrement on replacement) |
| IV.3 | Language-fallback-after-mismatch (ordered-preference traversal) | M | Cross-Cutting | **LAW 1** |
| IV.4 | Boat min-pax cancellation | S + M | **Scene 8** | **LAW 2** (boat pooled slots return on cancel) |
| IV.5 | Customer no-show → status transition | S + M | **Scene 9** | **LAW 3** (state-transition snapshot) |
| IV.6 | TTL expiry on abandoned Draft | S + M | **Scene 10** | **LAW 3** |
| IV.7 | Date blocking | S + M + U | **Scene 11** | none |

### Act V — Post-Trip Conversion

| Phase | Action | Min layer | Scene | Invariant |
|---|---|---|---|---|
| V.1 | Customer account creation prompt + prefill from portal data | S + U | Scene 5 | none |
| V.2 | Review prompt fires | M + U | Scene 5 | none |
| V.3 | First-repeat-use (customer logs in; prior booking visible + prefills for new booking) | S + U | — | none |

### End-of-run assertions

- Every LAW (1, 2, 3) has been exercised at least once across all Acts. A LAW not exercised anywhere is a spec gap, not an omission (§3 rule).
- Every Scene 1–5 (happy path) has a green phase.
- Every Scene 6–11 (unhappy that rejoin) has a green phase in Act IV.
- Every in-scope stakeholder from §14 progress snapshot has touched the booking at least once.

---

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

### P0-3 — `compressors` table missing `autoAccept` and `nitroxO2Percent`

- **Source:** Stop 1 audit (this skeleton — per Lesson #1).
- **Impact:** Compressor canonical JSON declares both fields (`autoAccept: true`, `nitroxO2Percent: 32`). Schema rejects these writes today. Stop 1 UI run cannot complete without the columns.
- **Action:**
  - Schema: add `compressors.autoAccept: v.boolean()` (default `true` server-side) and `compressors.nitroxO2Percent: v.optional(v.number())` (integer, range 22–40, required in mutation iff `gasMixes` includes `'nitrox'`).
  - Update `convex/compressors.ts:17-34` create + update args.
  - Update `convex/seedData.ts` compressor fixtures.
  - Extend zod validators in `src/lib/profile-form/profile-shared.ts`.

### P0-4 — Seed `SCUBA_MARKET.gasMixes` includes `'trimix'`

- **Source:** Stop 1 audit (this skeleton — per Lesson #1).
- **Impact:** Happy-path canonical scope is air + nitrox only. Seed fixture is richer and pollutes any test that reads the compressor seed expecting canonical parity.
- **Action:** One-line strip at `convex/seedData.ts:965`. Bundle with P0-3 ticket.

### P0-5 — Compressor profile form missing nitrox dropdown + auto-accept display

- **Source:** Stop 1 audit (this skeleton — per Lesson #1).
- **Impact:** With P0-3 schema fields live, FE still cannot capture `nitroxO2Percent` or surface the `autoAccept` state. Stop 1 UI run cannot complete without the input path.
- **Action:** `src/components/profiles/compressor-profile-form.tsx` — conditional scrollable integer select (22–40) when `nitrox` is selected in gas mixes; always-rendered disabled checkbox showing `checked=true` for auto-accept.

### P0-6 — `equipment` table missing `autoAccept`

- **Source:** Stop 2 audit (this skeleton — per Lesson #1).
- **Impact:** All three happy-path Equipment Managers (Hug, Ta, Nicole) declare `autoAccept: true` in canonical JSON. Schema rejects the write today.
- **Action:** Add `equipment.autoAccept: v.boolean()` (default `true` server-side) to schema; update `convex/equipment.ts` create + update args; add disabled checkbox on Equipment tab of `src/components/profiles/equipment-profile-form.tsx` (same pattern as compressor).

### P0-7 — `equipment.manufacturersByGearType` must be required non-empty

- **Source:** Stop 2 audit.
- **Impact:** An Equipment profile with zero declared gear types is nonfunctional for bookings. Canonical JSON requires a three-type minimum (wetsuit + bcd + regulator). Optional field permits the happy path to create a broken profile.
- **Action:** Tighten schema optional → required non-empty record. Tighten zod validator in `src/lib/profile-form/profile-shared.ts`. Add FE validation in Gear Catalog sub-tab.

### P0-8 — Booking-picker completeness gate (investigation)

- **Source:** Stop 2 audit; Matt's deliberate-incomplete Nicole test.
- **Impact:** Nicole starts with zero mask inventory. The happy path expects the Equipment picker in the booking form to hide / disable her until mask inventory is added. If the picker just lists all Equipment profiles regardless of inventory state, the test fails and path cannot demonstrate the gate.
- **Action:** Investigate how the booking-form Equipment dropdown builds its list. Grep `src/components/booking/**` for Equipment option rendering. If the filter is absent, file as a distinct blocker; if the filter exists, document where and cite the query.

### P0-9 — `boats` table missing `autoAccept`

- **Source:** Stop 3 audit.
- **Impact:** Both happy-path Boat stakeholders (Hug, PHUKET_DC) declare `autoAccept: true` in canonical JSON §7.12. Schema rejects the write today. Rule D (all resource roles display disabled auto-accept checkbox, Instructor exception) requires the column.
- **Action:**
  - Schema: add `boats.autoAccept: v.boolean()` (default `true` server-side) at `convex/schema.ts:356-386`.
  - Mutation: update `convex/boats.ts:37-51` create args and extras; update args at `convex/boats.ts:53-71`.
  - FE: add always-rendered disabled checkbox showing `checked=true` on Fleet tab in `src/components/profiles/boat-profile-form.tsx` (parallel to compressor P0-5 + equipment P0-6 pattern).
  - Seed: add `autoAccept: true` to HUG_OCEAN.boat + PHUKET_DC.boat at `convex/seedData.ts:274-289, 386-412`.

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

- **Source:** Stop 4 audit.
- **Impact:** Canonical instructor_3 (`wei-chen`) declares `teachingLanguages_completed: ['zh-CN', 'zh-TW', 'th', 'en']` — seed at `convex/seedInstructorData.ts:58` has `['zh-CN', 'zh-TW', 'th']` (no `'en'`). Happy-path Wei Chen is `isSeeded: false` with `teachingLanguages_initial: []` gap; the seeded Wei Chen user at the same slug blocks fresh onboarding.
- **Action:**
  - Seed extend: add `'en'` to Wei Chen's ROSTER entry (`seedInstructorData.ts:58`) so the seed-hydrated state matches canonical `_completed`.
  - Harness: the happy-path runner must either (a) delete the seeded Wei Chen before onboarding, (b) pick a distinct slug for the happy-path Wei Chen and alias canonical `slugRef`, or (c) document that the happy path resets and re-seeds before each run. Pick one; document in §7.12 or a new §15 "Harness conventions."
  - OPERATOR_PREFERRED check: `convex/seed.ts:467-493` — verify Hug's `preferredInstructorSlugs` includes `'wei-chen'`, `'ryan-clarke'`, and `'li-ming'` (current seed line 469 has `['wei-chen', 'nicole-tam', 'mike-chen', 'xiao-lei', 'zhen-liu']` — missing Ryan + Li Ming). Update if the happy path needs Hug to auto-prefer the 3 canonical instructors.
  - Same action for `dive_master` (`arisa-kanchanaburi`): verify DM-eligible preferences; Arisa's seed `['th', 'en']` already matches `_completed` so no seed language extension needed — only harness collision handling.

### P0-13 — `venues.autoAccept` for pool rows

- **Source:** Stop 6 audit.
- **Impact:** All four happy-path pools (Hug, Neptune, Water Pro, Shark Bites) declare `autoAccept: true`. Column absent. Rule D requires disabled FE checkbox for Pool role. DiveSite role is v0.1.1 defer — autoAccept UI excluded for DiveSite rows.
- **Action:**
  - Schema: add `venues.autoAccept: v.optional(v.boolean())` at `convex/schema.ts:402-419`.
  - Mutation: `convex/venues.ts:58-69` create args + update args — default `autoAccept: true` server-side when `venueCategory === 'pool'`.
  - FE: add always-rendered disabled checkbox `checked=true` on Capabilities tab in `src/components/profiles/pool-profile-form.tsx` (parallel compressor P0-5 / equipment P0-6 / boat P0-9 pattern). `dive-site-profile-form.tsx` — no checkbox (role deferred).
  - Seed: extend HUG_OCEAN.pool, NEPTUNE.pool, WATER_PRO.pool, SHARK_BITES.pool with `autoAccept: true` at `convex/seedData.ts:290-301, 338-349, 1007-1017, 1034-1044`.

### P0-14 — Seed `NEPTUNE.pool.isAllowed` must be `['z8mv4c']`

- **Source:** Stop 6 audit.
- **Impact:** Canonical `pool_2` declares Neptune's pool private to Neptune-driven bookings. Seed currently omits `isAllowed` (defaults to `[]` open). Seed/canonical drift — without the update, seed-hydrated state allows any operator to attach Neptune's pool, contradicting the happy-path access-control test.
- **Action:** At `convex/seedData.ts:338-349`, add `isAllowed: ['z8mv4c']` to NEPTUNE.pool. Parallel to the existing `NEPTUNE.equipment.isAllowed: ['z8mv4c']` pattern at `convex/seedData.ts:350-358`.

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

> **Deferred — unblocks after Stop 8 locks.** B.1 day-to-instructor assignment depends on the three customers' languages (defined in Stop 8 Customer canonical). Answer Cluster B in the same turn Stop 8 locks, using Lesson #5 committed defaults. Stop 4 Instructor is marked DONE in §14 for canonical-ledger purposes only; run-time choreography remains open until Cluster B answers land.

#### B.1 — Exact day-to-instructor assignment

- **Why it matters:** Locks the concrete booking itinerary used in Act II. Must exercise all four language-keyed instructors at least once.
- **Claude's recommendation:** O+AP is one booking of ~5 days (OW = 1 confined + 4 open-water; Advanced Plus adds 5 AOW dives, typically days 3–5). Rotate the four in-system instructors across the first four days; reserve Day 5 for external free-text fallback (see B.2). Pick exact per-day assignments in your answer — the constraint is every in-system instructor appears at least once, and day-to-language mapping aligns with the three customers' languages at least once each.
- **Matt's answer:** _(blank)_
- **Verification layer:** M (booking creation with per-day instructor binding), S (Reservation rows per day)

#### B.2 — Exact point where external free-text instructor enters

- **Why it matters:** Tests the free-text fallback code path. Must happen at a deterministic stop.
- **Claude's recommendation:** Day 5 of the O+AP booking — all four in-system instructors unavailable (conflicting schedules, days off, language mismatch). Agent or DC adds external free-text instructor ("Alex Rivera") inline. System accepts and treats as auto-confirmed per V1 Done Scene 2 ("Hand-entered instructor treated as auto-confirmed").
- **Matt's answer:** _(blank)_
- **Verification layer:** M (Reservation row has external-instructor flag, no profile FK), U (free-text input accepts name)

#### B.3 — Does the path need to prove language-matching FAILURE before fallback?

- **Why it matters:** Determines whether the spec needs a stop where preferred-instructor language mismatch triggers fallback-down-list.
- **Claude's recommendation:** Yes — once. One booking day has a customer language not matched by the #1 preferred instructor; the cascade falls to the #2 preferred instructor with matching language. Proves both that language match is enforced and that fallback traversal works.
- **Matt's answer:** _(blank)_
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
  - DD-317 (referral loads operator prefs — not built)
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
3. Referral and preference-cascade behavior has known drift risk (DD-317).
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

**State at handoff:** Stops 1–6 + `admin_venues.kata_beach` locked in §7.12. §9 holds P0-1 through P0-14. §14 is the resume pointer; §7.12 + §9 are the ledger (Lesson #1). Three stops remain: Stop 7 (DiveCenter), Stop 8 (Customer — lighter portal template), Stop 9 (Agent — renumbered from old Stop 10; Stop 10 deleted).

### Audit structure

Stakeholder audit stops split into three layers (see §0 Glossary for full definitions):

- **Resource stakeholders (Stops 1–6)** — Compressor, Equipment Manager, Boat, Instructor, DiveMaster, Pool. Independent; don't cross-reference each other except via multi-role users sharing rows (Lesson #9).
- **Customer (Stop 8)** — bookee. Lighter audit template — portal fixture fields + one deliberate-incomplete pair. No userRoles row, no autoAccept, no isAllowed.
- **Operator stakeholders (Stops 7, 9)** — DiveCenter, Agent. Orchestrate bookings; depend on resource stakeholders. Agent additionally depends on DiveCenter (referral functionality). **Ordering:** resources (1–6) → customer (8) → operators (7 DC, 9 Agent) — operators last because they depend on resources; Agent last within operators because it depends on DC. Operator role subsumed by DiveCenter — no separate Operator stop.
- **Admin (admin_venues)** — pre-seeded venues with no owner. **Kata Beach is the sufficient single exemplar** — more admin venues can be added post-audit without reopening.

### Lessons carried forward (read before resuming)

These rules fire from mistakes already made this audit. Do not relearn.

1. **Skeleton §7.12 + §9 are the ONLY canonical ledger.** No shadow plan file, no parallel ledger in `.claude/plans/`. A plan file created by plan mode is a harness artifact; migrate content out immediately and delete. Mistake: Stops 1 + 2 canonical drifted into plan file while skeleton stayed stale for 2 rounds. Cost: wasted edits + Matt catching it twice.

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
| 1 | Resource | Compressor ×2 | DONE (retro-patched 2026-04-14 — compressor_2 now carries `gasMixes_initial: []`) | compressor_1 (Scuba Market), compressor_2 (Chalong Pier, gasMixes-gap) | P0-2, P0-3, P0-4, P0-5 (4) | harmonized |
| 2 | Resource | Equipment Manager ×3 | DONE | equipment_manager_1 (Hug), equipment_manager_2 (Scuba Revolution), equipment_manager_3 (Nicole — mask-empty) | P0-6, P0-7, P0-8 (3) | harmonized |
| 3 | Resource | Boat ×2 | DONE | boat_1 (Hug, M.V. Hug Ocean), boat_2 (PHUKET_DC, MQ5+MQ7) | P0-9, P0-10, P0-11 (3) | harmonized |
| 4 | Resource | Instructor ×3 | DONE | instructor_1 (Ryan), instructor_2 (Li Ming), instructor_3 (Wei Chen, teachingLanguages-gap) | P0-12 (1) | harmonized |
| 5 | Resource | DiveMaster | DONE | dive_master (Arisa, teachingLanguages-gap) | covered by P0-12 | harmonized |
| 6 | Resource | Pool ×4 | DONE | pool_1 (Hug), pool_2 (Neptune isAllowed), pool_3 (Water Pro maxCapacity-gap), pool_4 (Shark Bites) | P0-13, P0-14 (2) | harmonized |
| admin | Admin | AdminVenue | DONE (Kata Beach = single sufficient exemplar) | `admin_venues.kata_beach` | none | harmonized |
| 7 | Operator | DiveCenter | NOT STARTED | stale `dive_center` — split into `dive_center_1` / `dive_center_2` | n/a yet | pending |
| 8 | Customer | Customer | NOT STARTED (lighter portal template) | not yet written | n/a yet | pending |
| 9 | Operator | Agent | NOT STARTED (depends on Stop 7 DCs for referral) | stale `agent` entry | n/a yet | pending |
| — | Cross-cutting | Act II spine (submitToDraft bug) | OPEN | n/a (bug, not ledger entry) | P0-1 (1) | — |

**§11 harmonization rule:** when a stop locks DONE, update its §11 recommendation status the same turn. The "§11 rec" column flips `pending` → `harmonized` as part of the same-turn discipline.

### Pre-run blocker gate

**All P0s in §9 must close before the happy-path run can execute.** Filing rule: when a stop locks DONE, file its P0s to `.tickets/DD-*.md` via `/board` the same turn. Don't batch to audit end; don't defer.

Batching for reference:
- Stop 1 (Compressor): P0-2, P0-3, P0-4, P0-5
- Stop 2 (Equipment): P0-6, P0-7, P0-8
- Stop 3 (Boat): P0-9, P0-10, P0-11
- Stops 4+5 (Instructor + DiveMaster): P0-12
- Stop 6 (Pool): P0-13, P0-14
- Cross-cutting (Act II spine): P0-1 (`submitToDraft` bug)

Stops 7, 8, 9 will add P0-15+ as they lock.

### Per-stop validation checklist

Before flipping a stop's status to DONE, verify:

1. Canonical JSON in §7.12 parses as valid JSON.
2. Every `<field>_initial` has a matching `<field>_completed`.
3. Every `slugRef` points to a user defined in another stop's canonical block.
4. Seed values cited in the entry match the current `convex/seedData.ts` (Lesson #4).
5. §7.12.0 Canonical entry schema requirements for the entry type are met.
6. `§11 rec` column flipped `pending` → `harmonized`.
7. P0 blockers filed to `.tickets/` the same turn.

### Next-stop staging rule

Only **one stop's interview state** is queued in §14 at a time. When the queued stop locks DONE, overwrite its interview-state block with the next unlocked stop's in the same turn. Current order: Stop 7 → Stop 8 → Stop 9.

### Stop 7 DiveCenter — interview state (next resume point)

**Explore findings** (schema `convex/schema.ts`, form `src/components/profiles/dive-center-profile-form.tsx`, seed `convex/seedData.ts` — line numbers are point-in-time, re-grep if refactored):

- **Schema fields:** `userId`, `name`, `placeName`, `country`, `lat`, `lng`, `email`, `phone`, `associations[] {agency, number, owDays?, aowDays?, oaDays?, selectedSpecialties?[]}`, `customerLanguages` (optional — tightens to required min 1 per P0-2), `isAllowed/notAllowed`, `verified`. **No `autoAccept` column** — organizer role (Lesson #8).
- **Seed DCs available:** HUG_OCEAN (n7rq5j), NEPTUNE (z8mv4c — user-blocked in pool_2), PHUKET_DC (p5ky3w — user-blocked in boat_2), NICOLE_DC (q9bz7r — user-blocked in equipment_manager_3), SCUBA_REVOLUTION (v8sr2p — user-blocked in equipment_manager_2). All multi-role; reference via `slugRef` per Lesson #9.

**Committed defaults for the 4 open questions** (per Lesson #5 — Matt overrides if wrong):

1. **How many DCs?** Default: **2 (Hug + Nicole).** Override to 3+ only if referral-cascade test requires fuller coverage.
2. **Secondary DC identity?** Default: **Nicole** — seed-match; user row already blocked in equipment_manager_3, slugRef keeps it DRY.
3. **Deliberate-incomplete field?** Default: **`associations_initial: []`** — blocks course creation at the root, natural onboarding step for new DCs.
4. **customerLanguages `_completed` values?** Default: **seed-canonical** — HUG_OCEAN `['zh-CN','zh-TW','th','en']`, NICOLE_DC `['zh-TW','zh-CN','en','th']`. Override to extend language matrix if test needs it.

### Resume instructions for the next session

1. Read skeleton §14 (this section) first. Internalize all 10 lessons and the validation checklist.
2. Open Stop 7 DiveCenter. Use the committed defaults above unless Matt overrides. **Same-turn discipline:** canonical into §7.12 + blockers into §9 + deliberate-incomplete header-table row + §14 progress row + §11 harmonization + file P0s via `/board` + overwrite interview-state block with Stop 8's → DONE in one turn.
3. Then Stop 8 Customer (lighter portal template — see Audit structure). No autoAccept / isAllowed / userRoles row.
4. Then Stop 9 Agent (same template as Stop 7, references DC slugs from Stop 7 via slugRef).
5. After Stop 9 locks: rewrite §14 as "audit COMPLETE" — all rows DONE, §9 at final count, §11 fully harmonized.
6. **Run happy-path only after every P0 in §9 is closed.** During the run, follow §15 Execution Conventions.

### For the next LLM — context handoff summary

You inherit a **work-in-progress stakeholder field audit** feeding the DiveDispatch happy-path spec at `ultraplan/happy-path-spec-skeleton.md`. §7.12 is the canonical stakeholder ledger (ACTIVE — edit in place); §9 is the blocker queue. Stops 1–6 + admin_venues are locked. Three stops remain: Stop 7 DiveCenter (operator), Stop 8 Customer (lighter portal template), Stop 9 Agent (operator; depends on Stop 7 for referral). All P0s must close before the happy-path run. Open Stop 7 with the 4 committed defaults above; follow the 10 lessons — especially #1 (skeleton-only ledger), #4 (seed wins), #5 (commit defaults on every open Q), #9 (slugRef for multi-role), #10 (admin venues outside stakeholders).

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
