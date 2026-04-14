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

Use as primary references while answering:

- `Vaults/DiveDispatch/Product/Product Definition.md`
- `Vaults/DiveDispatch/Product/V1 Done Criteria.md`
- `Vaults/DiveDispatch/Product/HappyPath.md`
- `Vaults/DiveDispatch/Product/WhatAmIDoing.md`
- `Vaults/DiveDispatch/Product/Launch-Walkthrough.md`
- `Vaults/DiveDispatch/HappyPath/Stops.md`
- `Vaults/DiveDispatch/HappyPath/Observations.md`
- `Vaults/DiveDispatch/HappyPath/Fixture.md`
- `CLAUDE.md` (LAW invariants)

---

## 7. Locked Context (preserved)

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

### 7.12 Act I — Field ledgers (canonical prefill)

Canonical stakeholder data for the happy path is defined in **one JSON document** below. Keys match Convex table shapes where applicable; `userId` / `tokenIdentifier` / `slug` are assigned at runtime and omitted here. `isAllowed` and `notAllowed` default to `[]` when absent. Nitrox canonical **O₂ 32%** applies to messaging and future `nitroxO2Percent` when implemented.

```json
{
  "order": [
    "compressor_1",
    "compressor_2",
    "equipment_manager_1",
    "equipment_manager_2",
    "equipment_manager_3",
    "boat",
    "instructor_1",
    "instructor_2",
    "instructor_3",
    "dive_master",
    "pool",
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
        "gasMixes": ["air", "nitrox"],
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
      "note": "Nicole Dive Center — external; shared user with DC role (see dive_center canonical for Stop 8). Starts deliberately incomplete: ZERO mask SKUs. Happy-path scene walks mask-inventory add before she becomes selectable in bookings.",
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
    "boat": {
      "role": "Boat",
      "users": {
        "email": "fleet@andamancharter.phuket",
        "name": "Marcus Webb",
        "firstName": "Marcus",
        "lastName": "Webb",
        "businessName": "Andaman Day Charters",
        "appLanguage": "en",
        "customerLanguages": ["en"],
        "phone": "+66 81 555 0101",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "boats": {
        "name": "Andaman Day Charters",
        "placeName": "Chalong Pier, Phuket",
        "country": "Thailand",
        "lat": 7.817,
        "lng": 98.339,
        "email": "fleet@andamancharter.phuket",
        "phone": "+66 81 555 0101",
        "fleet": [
          {
            "boatName": "Blue Manta",
            "maxPax": 12,
            "minPax": 1,
            "boatType": "day_boat",
            "seatCapacity": 12,
            "routes": [{ "diveSite": "Racha Yai", "daysOfWeek": [1, 3, 5] }],
            "cutoffHours": 18
          }
        ],
        "hasCompressor": true,
        "isAllowed": [],
        "notAllowed": [],
        "verified": false
      }
    },
    "instructor_1": {
      "role": "Instructor",
      "label": "English-only",
      "users": {
        "email": "james.owsi@hugocean.example",
        "name": "James Miller",
        "firstName": "James",
        "lastName": "Miller",
        "businessName": "James Miller",
        "appLanguage": "en",
        "customerLanguages": ["en"],
        "phone": "+66 89 100 2001",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "instructors": {
        "name": "James Miller",
        "placeName": "Kata, Phuket",
        "country": "Thailand",
        "lat": 7.82,
        "lng": 98.3,
        "email": "james.owsi@hugocean.example",
        "phone": "+66 89 100 2001",
        "credential": [
          {
            "agency": "PADI",
            "level": "Open Water Scuba Instructor",
            "agencyID": "PAD-INS-10001",
            "specialtyRatings": ["Deep", "Nitrox", "Wreck"]
          }
        ],
        "teachingLanguages": ["en"],
        "isAllowed": [],
        "notAllowed": [],
        "verified": true
      }
    },
    "instructor_2": {
      "role": "Instructor",
      "label": "English + Simplified Chinese",
      "users": {
        "email": "li.wei@hugocean.example",
        "name": "Li Wei",
        "firstName": "Wei",
        "lastName": "Li",
        "businessName": "Li Wei",
        "appLanguage": "en",
        "customerLanguages": ["en", "zh-CN"],
        "phone": "+66 89 100 2002",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "instructors": {
        "name": "Li Wei",
        "placeName": "Patong, Phuket",
        "country": "Thailand",
        "lat": 7.89,
        "lng": 98.295,
        "email": "li.wei@hugocean.example",
        "phone": "+66 89 100 2002",
        "credential": [
          {
            "agency": "PADI",
            "level": "Open Water Scuba Instructor",
            "agencyID": "PAD-INS-10002",
            "specialtyRatings": ["Deep", "Nitrox"]
          }
        ],
        "teachingLanguages": ["en", "zh-CN"],
        "isAllowed": [],
        "notAllowed": [],
        "verified": true
      }
    },
    "instructor_3": {
      "role": "Instructor",
      "label": "English + Traditional Chinese",
      "users": {
        "email": "chen.mei@hugocean.example",
        "name": "Chen Mei-ling",
        "firstName": "Mei-ling",
        "lastName": "Chen",
        "businessName": "Chen Mei-ling",
        "appLanguage": "en",
        "customerLanguages": ["en", "zh-TW"],
        "phone": "+66 89 100 2003",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "instructors": {
        "name": "Chen Mei-ling",
        "placeName": "Phuket Town",
        "country": "Thailand",
        "lat": 7.88,
        "lng": 98.39,
        "email": "chen.mei@hugocean.example",
        "phone": "+66 89 100 2003",
        "credential": [
          {
            "agency": "PADI",
            "level": "Open Water Scuba Instructor",
            "agencyID": "PAD-INS-10003",
            "specialtyRatings": ["Deep", "Night"]
          }
        ],
        "teachingLanguages": ["en", "zh-TW"],
        "isAllowed": [],
        "notAllowed": [],
        "verified": true
      }
    },
    "dive_master": {
      "role": "DiveMaster",
      "users": {
        "email": "sam.dm@hugocean.example",
        "name": "Sam Okonkwo",
        "firstName": "Sam",
        "lastName": "Okonkwo",
        "businessName": "Sam Okonkwo",
        "appLanguage": "en",
        "customerLanguages": ["en"],
        "phone": "+66 89 100 2004",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "diveMasters": {
        "name": "Sam Okonkwo",
        "placeName": "Rawai, Phuket",
        "country": "Thailand",
        "lat": 7.78,
        "lng": 98.33,
        "email": "sam.dm@hugocean.example",
        "phone": "+66 89 100 2004",
        "credential": [
          {
            "agency": "PADI",
            "level": "Divemaster",
            "agencyID": "PAD-DM-20001"
          }
        ],
        "teachingLanguages": ["en"],
        "isAllowed": [],
        "notAllowed": [],
        "verified": true
      }
    },
    "pool": {
      "role": "Pool",
      "users": {
        "email": "pool@hugocean.example",
        "name": "Hug Ocean Pool Ops",
        "firstName": "Pool",
        "lastName": "Ops",
        "businessName": "Hug Ocean Training Pool",
        "appLanguage": "en",
        "customerLanguages": ["en", "th"],
        "phone": "+66 76 600 7000",
        "isSeeded": false,
        "onboardingComplete": true
      },
      "venues": {
        "name": "Hug Ocean Confined Pool",
        "placeName": "Chalong, Phuket",
        "country": "Thailand",
        "lat": 7.85,
        "lng": 98.34,
        "email": "pool@hugocean.example",
        "phone": "+66 76 600 7000",
        "venueCategory": "pool",
        "diveSiteTypes": [],
        "hasCompressor": false,
        "confinedCapable": true,
        "maxDepth": 5.5,
        "maxCapacity": 12,
        "isAllowed": [],
        "notAllowed": [],
        "verified": true
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
  }
}
```

**Resume:** Act I canonical stakeholder JSON above is the single source for prefilled onboarding; align UI steps and DB assertions to these values (adjust emails slugs when wiring to real Clerk/Convex ids).

---

## 8. Proposed Acts partition

Claude recommends partitioning the path into five Acts to stay navigable. Act structure is a hypothesis — see K.1.

- **Act I — Onboarding.** One phase per stakeholder role. Ends when all roles logged-in with complete profiles and verified persistence.
- **Act II — Booking Convergence.** Canonical spine. Agent creates the O+AP booking, portal completes, resources confirm, booking auto-advances Draft → Upcoming → Active → Completed.
- **Act III — Variation Matrix.** Language × channel × partial-progress × referral-toggle combinations that must all hold against the same booking created in Act II.
- **Act IV — Branch Probes.** In-spec unhappy branches that rejoin: medical block-and-lift, decline-and-reassign cascade, language-fallback-after-mismatch.
- **Act V — Post-Trip Conversion.** Account creation, prefill, review prompt, first-repeat-use.

---

## 9. Prerequisites (known blockers)

### P0-1 — `submitToDraft` writes only the instructor reservation

- **Observation:** `Vaults/DiveDispatch/HappyPath/Observations.md:8–14`
- **Impact:** Pool, Equipment, Compressor reservations never created. FSM guard keeps booking in Draft permanently. Act II spine is red-lined.
- **Action:** Ticket as P0 before any full happy-path run. See L.1.

### P0-2 — `customerLanguages` lives on `users` instead of on operator role tables

- **Source:** Stop 1 audit, `~/.claude/plans/resilient-enchanting-lantern.md` B-1.
- **Impact:** Non-operator roles (Compressor, Equipment, Boat, Pool, Instructor, DiveMaster) carry a field they do not logically own. Canonical JSON for Stops 8 (DC) + 10 (Agent) cannot assert `agents.customerLanguages` because the column does not exist yet.
- **Action:**
  - Schema: remove `users.customerLanguages` (`convex/schema.ts:30`); tighten `diveCenters.customerLanguages` to required min 1 (line 329); add `agents.customerLanguages` required min 1 (line 502-515).
  - FE rewire: `src/components/profiles/agent-profile-form.tsx:56-60, 78-80` — switch read path from `me.customerLanguages` to `p.customerLanguages`.
  - UI form fields already shipped on DC + Agent; no new form work.

### P0-3 — `compressors` table missing `autoAccept` and `nitroxO2Percent`

- **Source:** Stop 1 audit, `~/.claude/plans/resilient-enchanting-lantern.md` B-2.
- **Impact:** Compressor canonical JSON declares both fields (`autoAccept: true`, `nitroxO2Percent: 32`). Schema rejects these writes today. Stop 1 UI run cannot complete without the columns.
- **Action:**
  - Schema: add `compressors.autoAccept: v.boolean()` (default `true` server-side) and `compressors.nitroxO2Percent: v.optional(v.number())` (integer, range 22–40, required in mutation iff `gasMixes` includes `'nitrox'`).
  - Update `convex/compressors.ts:17-34` create + update args.
  - Update `convex/seedData.ts` compressor fixtures.
  - Extend zod validators in `src/lib/profile-form/profile-shared.ts`.

### P0-4 — Seed `SCUBA_MARKET.gasMixes` includes `'trimix'`

- **Source:** Stop 1 audit, `~/.claude/plans/resilient-enchanting-lantern.md` B-3.
- **Impact:** Happy-path canonical scope is air + nitrox only. Seed fixture is richer and pollutes any test that reads the compressor seed expecting canonical parity.
- **Action:** One-line strip at `convex/seedData.ts:965`. Bundle with P0-3 ticket.

### P0-5 — Compressor profile form missing nitrox dropdown + auto-accept display

- **Source:** Stop 1 audit, `~/.claude/plans/resilient-enchanting-lantern.md` B-5.
- **Impact:** With P0-3 schema fields live, FE still cannot capture `nitroxO2Percent` or surface the `autoAccept` state. Stop 1 UI run cannot complete without the input path.
- **Action:** `src/components/profiles/compressor-profile-form.tsx` — conditional scrollable integer select (22–40) when `nitrox` is selected in gas mixes; always-rendered disabled checkbox showing `checked=true` for auto-accept.

### P0-6 — `equipment` table missing `autoAccept`

- **Source:** Stop 2 audit, `~/.claude/plans/resilient-enchanting-lantern.md` Stop 2 blockers.
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

*(Matt: add additional known blockers below or leave for L.2. See `~/.claude/plans/resilient-enchanting-lantern.md` for the audit-discipline note and B-4 schema-hygiene review item.)*

---

## 10. Open Questions — Answer-Fillable

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

Read alongside your answers. These are opinions, not locks.

1. **Split intent achieved.** Skeleton is the contemplation brief; executable specs go to `Vaults/DiveDispatch/wiki/Plans/happy-path-*.md` once locked.
2. **Cite V1 Done Scenes per stop.** When promoting locked answers into executable form, every stop's action cites which V1 Scene it validates.
3. **Land the Draft → Upcoming fix first** (P0-1).
4. **Keep current `Stops.md` as smoke test.** The zero-seed full happy path is additive, not a replacement.
5. **Anchor on LAW invariants.** Each inventory-writing stop carries an `Invariant:` block naming which LAW. See K.3.
6. **Separate unhappy-path terminators** — J.7.
7. **Reconcile account-prompt wording once and lock** — J.6.
8. **Dev-env reminder strategy = fire-now endpoint** — G.3 / J.5.

## 12. Known Implementation Tensions

Preserved from the original brief:

1. Product intent and implementation are not identical.
2. Some reminder and messaging behaviors are specified in docs but only partially implemented (DD-362, DD-354, DD-363).
3. Referral and preference-cascade behavior has known drift risk (DD-317).
4. Existing walkthrough observations show a booking can appear healthy while still missing required reservation writes (`Observations.md:8–14`).
5. Post-trip conversion is conceptually richer in the docs than in clearly finished UX.

## 13. Anti-Patterns for the Next LLM

Do not:
- reduce this to "make one booking succeed quickly"
- assume seed-data shortcuts are acceptable replacements
- assume every LOCKED item is already implemented in code
- collapse stakeholder setup into a trivial prerequisite
- confuse this contemplation brief with `/happypath` execution stops
- propose code changes based on this doc alone — promote to executable spec first

## 14. Resume Point — Happy-Path Stakeholder Field Audit

**Last session:** 2026-04-14. Handoff for context reset.

### Lessons carried forward (read before resuming)

These rules fire from mistakes already made this audit. Do not relearn.

1. **Skeleton §7.12 + §9 are the ONLY canonical ledger.** No shadow plan file, no parallel ledger in `.claude/plans/`. A plan file created by plan mode is a harness artifact; migrate content out immediately and delete. Mistake: Stops 1 + 2 canonical drifted into plan file while skeleton stayed stale for 2 rounds. Cost: wasted edits + Matt catching it twice.

2. **Orient to the whole app once, not stop-by-stop.** Before Stop 1, read in parallel: `convex/schema.ts` (all 39 tables), `convex/seedData.ts` (every seed fixture), `src/components/profiles/*.tsx` (every role form), `src/components/account/profile-basic-info.tsx` (shared Profile-tab primitives), `src/lib/constants/roles.ts` (tab config). This catches (a) multi-role users like `HUG_OCEAN` (DC+Boat+Pool+Equipment) and `NICOLE_DC` (DC+Equipment) — same user across multiple stop entries, not separate stakeholders; (b) shared primitives already shipped (firstName/lastName/nickname/DOB/appLanguage) so they don't get false-flagged; (c) helper builders like `buildNicoleInventoryOverrides()` that encode inventory generation patterns. Narrow per-stop Explore agents missed all three categories and produced false blockers.

3. **Verify FE presence before flagging a gap.** For every "not in UI" / "not wired" claim, grep across `src/components/profiles/**`, `src/components/account/**`, `convex/http.ts`, `convex/lib/**` before promoting to blocker. A gap retractable by one grep is a discipline failure. Provenance: Stop 1 false-flagged `customerLanguages` on DC/Agent (already at `dive-center-profile-form.tsx:153-157` + `agent-profile-form.tsx:207-210`) and Clerk `firstName`/`lastName` bridge (already at `convex/http.ts:136-149`).

4. **Seed is canonical — not skeleton's pre-existing JSON.** When seed and skeleton §7.12 disagree, seed wins. Skeleton had invented data like "Ta Revolution" (last name), `appLanguage: 'en'` for Thai operators, and 5-gear-type manufacturer lists. Seed had Anong Petcharat, `th`, and 2-3-type manufacturer lists. Seed is the production-ready truth; skeleton pre-existing JSON was a guess.

5. **Don't ask stupid questions. Commit to reasonable defaults and let Matt correct.** Matt has interrupted to say this. When proposing values, commit with seed + production-realistic defaults; surface only the decisions that are not inferable. Multi-option A/B/C interviews are for interview mode on real ambiguity (business rules, policy), not on "which brand" or "how many sizes."

6. **Deliberate-incomplete test patterns are valuable.** Nicole starts with empty mask SKUs so the happy path exercises the booking-picker completeness gate. One stakeholder per role should carry an intentional gap that the path-walkthrough completes. Bake this into Stops 4-10 when appropriate (e.g., an instructor with incomplete teachingLanguages; an agent without preferredReferral set).

7. **`isAllowed` / `notAllowed` is role-specific, not universal.** Compressor defers to future version. Equipment actively uses it (Hug's boat + equipment are private to Hug-driven bookings via `isAllowed: ['n7rq5j']`). Check the seed for each role before assuming.

8. **Auto-accept is a row-level boolean + disabled FE checkbox for every resource role.** Compressor (P0-3), Equipment (P0-6). Boat likely parallel. Pool, Instructor, DiveMaster — investigate when you hit those stops. Field always `true` server-side in V1; disabled in UI as a display tell.

9. **Multi-role users share one `users` row, N role profiles.** `HUG_OCEAN` user `Somchai Prasert` (slug n7rq5j) owns `diveCenters`, `boats`, `venues` (pool), `equipment` rows simultaneously. Canonical JSON for each stop references the same user via `slugRef` — not a separate user block per stop. Don't duplicate user data across stops; reference the shared row.

### Progress snapshot

| Stop | Role | Status | Canonical in §7.12 | Blockers in §9 |
|---|---|---|---|---|
| 1 | Compressor ×2 | DONE | compressor_1 (Scuba Market), compressor_2 (Chalong Pier) | P0-2 (customerLanguages migration), P0-3 (autoAccept + nitroxO2Percent), P0-4 (strip trimix seed), P0-5 (FE nitrox + disabled auto-accept) |
| 2 | Equipment Manager ×3 | DONE | equipment_manager_1 (Hug Ocean), equipment_manager_2 (Scuba Revolution / Anong "Ta" Petcharat), equipment_manager_3 (Nicole Dive Center — mask-empty start) | P0-6 (equipment.autoAccept), P0-7 (manufacturersByGearType required min 1), P0-8 (booking-picker completeness gate investigation) |
| 3 | Boat | INTERRUPTED mid-interview | skeleton §7.12 `boat` still has original stale entry (Andaman Day Charters / Marcus Webb). Needs replacement. | n/a yet |
| 4-10 | Instructor ×3 / DiveMaster / Pool / DC (Hug primary + Nicole secondary) / Agent | NOT STARTED | stale skeleton entries | n/a yet |

### Stop 3 Boat — interview state at interruption

**Explore findings** (schema `convex/schema.ts:356-386`, form `src/components/profiles/boat-profile-form.tsx`):

Real gaps:
- `fleet[].seatCapacity` — BE accepts (schema + validator), FE has zero input path. Either add FE input or strip from schema.
- `fleet[].cutoffHours` + `fleet[].minPax` + `fleet[].routes` — collected on FE; silent on BE (no booking cascade reads them except `routes` for calendar display). Deferred business logic or dead weight.
- `autoAccept` — no field on `boats` table, no UI. Parallel Compressor/Equipment pattern missing.

Open questions (Matt to answer at resume):

1. **# of boat providers** — Hug internal only, or Hug internal + 1 external charter (parallel Equipment pattern)?
2. **Auto-accept on Boat** — add `boats.autoAccept: v.boolean()` default true, FE disabled checkbox (parallel Compressor/Equipment)? Expected yes.
3. **seatCapacity** — add FE input in Fleet tab per-vessel, or strip from schema as dead field?
4. **Silent BE fields (cutoffHours + minPax + routes-daysOfWeek)** — mark for future enforcement ticket, or accept as display-only for V1?
5. **isAllowed on Boat** — Hug's boat private to Hug-driven bookings (parallel Equipment), or open?
6. **Boat inventory model** — does Boat need SKU-style inventory like Equipment (per-vessel seat-count units on `inventoryUnits`)? Verify before canonical write.

Seed reference:
- `HUG_OCEAN.boat` at `convex/seedData.ts:274-289` — single vessel "M.V. Hug Ocean", day_boat, maxPax 50, route to Racha all days.
- `PHUKET_DC.boat` at `seedData.ts:386-400+` — "Mandarin Queen", maxPax 70. Not a Boat-only stakeholder (owner is DC).
- No standalone Boat-only stakeholders in seed. Second external boat provider (if Matt wants) requires inventing identity, or reusing a DC-owned boat.

### Resume instructions for the next session

1. Read skeleton §14 (this section) first.
2. Confirm discipline rules above apply.
3. Open Stop 3 Boat with Matt's answers to the 6 questions above.
4. As each stop locks, **immediately update skeleton §7.12 canonical + §9 blockers in the same turn**. Do not stage in plan file.
5. After Stop 10, re-hydrate §14 with fresh handoff or mark audit COMPLETE.

### Prerequisite tickets (from §9)

All P0-1 through P0-8 are ready to file against `.tickets/DD-*.md` via `/board`. Not blocking the audit — file when convenient.
