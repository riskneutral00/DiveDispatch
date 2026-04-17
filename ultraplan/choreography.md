---
type: choreography
purpose: Play-by-play spec for the happy-path run. Acts I–V, phase-keyed.
related_files:
  - canonical.json        # values: every stakeholder, every field
  - canonical.schema.json # shape contract for canonical.json
  - assertions.yaml       # expected state per (act, phase)
  - happy-path-spec-skeleton.md  # meta, audit state, §15 execution rules
last_touched: 2026-04-14
---

# Happy-Path Choreography

Five Acts partition the run. Each phase cites:

- **Canonical key** — reference into `canonical.json` for every value. **Never inline literal values; always reference the key.**
- **Min layer** — S / M / U per §2 Testability Principle (skeleton).
- **Scene** — per `Vaults/DiveDispatch/Product/V1 Done Criteria.md`.
- **Invariant** — per §3 LAW (skeleton). Cite the LAW the phase exercises, or `none`.
- **Assertion key** — link into `assertions.yaml` (form: `act_X_phase_Y`).

**Execution rules (§15 of skeleton) apply:** pause on every UI page before clicking next; every run writes to `Vaults/DiveDispatch/HappyPath/Runs/<timestamp>.md`; post-run observations route to §9 / §14 (skeleton) per §15 rule 3.

---

## Act I — Onboarding (Stakeholder Creation)

Each resource + operator stakeholder logs in, completes onboarding, verifies persistence. One sub-phase per canonical id. Customer is not onboarded here (joins via portal in Act II). Admin venues are pre-seeded (no phase).

| Phase | Canonical key | Min layer | Scene | Invariant | Assertion key |
|---|---|---|---|---|---|
| I.1 | `stakeholders.compressor_1`, `.compressor_2` | S + U | Scene 15 | none | `act_1_phase_1` |
| I.2 | `stakeholders.equipment_manager_1`, `.equipment_manager_2`, `.equipment_manager_3` | S + U | Scene 14 | none | `act_1_phase_2` |
| I.3 | `stakeholders.boat_1`, `.boat_2` | S + U | — | none | `act_1_phase_3` |
| I.4 | `stakeholders.instructor_1`, `.instructor_2`, `.instructor_3` | S + U | Scene 13 | none | `act_1_phase_4` |
| I.5 | `stakeholders.dive_master` | S + U | — | none | `act_1_phase_5` |
| I.6 | `stakeholders.pool_1`, `.pool_2`, `.pool_3`, `.pool_4` | S + U | — | none | `act_1_phase_6` |
| I.7 | `stakeholders.dive_center_1`, `.dive_center_2` | S + U | **Scene 1** | none | `act_1_phase_7` |
| I.8 | `stakeholders.agent` | S + U | — | none | `act_1_phase_8` |

**Per-phase flow (applies to every Act I phase):**

1. Sign out any existing session (§15 reset rule, between-run hygiene).
2. Sign in via Clerk SSO using `canonical.stakeholders.<id>.users.email` + fixture password + OTP `424242`.
3. Complete onboarding wizard — every FE field maps to a canonical value. If the canonical entry carries a `<field>_initial` / `<field>_completed` pair, enter `<field>_initial` (the gap state). Completion happens in Act II/III.
4. Navigate to profile tabs; fill every field declared on the role-specific sub-object (e.g. `canonical.stakeholders.compressor_1.compressors.*`).
5. Refresh the page; verify all values persisted (§2 S layer).

**End-of-Act assertion (see `assertions.yaml#act_1_end`):** every canonical user has a persisted `users` row + N role rows per Lesson #9; every deliberate-incomplete pair still shows `_initial` state (closes in Act II / III). Auto-accept is user-level (`stakeholderPreferences.acceptanceMode`), not a resource-row field.

---

## Act II — Booking Convergence (Canonical Spine)

| Phase | Action | Canonical reference | Min layer | Scene | Invariant | Assertion key |
|---|---|---|---|---|---|---|
| II.1 | Agent (or DC) drags O+AP quick-book onto calendar → booking in `Draft` | `stakeholders.agent` or `.dive_center_1` as booking owner | S + M | **Scene 2** | none | `act_2_phase_1` |
| II.2 | `submitToDraft` writes instructor + pool + equipment + compressor reservations atomically with AvailabilitySnapshot | all resource canonical keys touched by this booking | S + M | **Scene 2** | **LAW 3** (same-mutation snapshot atomicity). **Currently broken — P0-1.** | `act_2_phase_2` |
| II.3 | Portal link generated → customer opens → completes medical + waiver + sizing + emergency contact | `stakeholders.customer_1`, `.customer_2`, `.customer_3` | S + M + U | **Scene 3** | none | `act_2_phase_3` |
| II.4 | Resource-side confirmations cascade (auto-accept for Compressor / Equipment / Boat / Pool / DiveMaster; manual accept for Instructor) | Per-user `stakeholderPreferences.acceptanceMode` drives the gate (Instructor → `PrePayRequired`; others → `Auto`). Day-to-instructor schedule per Cluster B.1 notes below. | S + M | Scene 2 + Scene 7 (decline branch in Act IV) | **LAW 1** (exclusive-unit: instructor cannot double-hold); **LAW 2** (pooled: pool/equipment count decrements; blocks only at zero) | `act_2_phase_4` |
| II.5 | Booking auto-advances Draft → Upcoming → Active → Completed as gates fire | — | S + M | **Scene 4** | **LAW 3** (snapshot atomicity on state transitions) | `act_2_phase_5` |
| II.6 | Dive day opens → check-in → activity completes | `admin_venues.kata_beach` (dive site) | S + M + U | **Scene 5** | none | `act_2_phase_6` |

**Phase II.4 — day-to-instructor mapping (Cluster B committed defaults, 2026-04-14):**

| Day | Activity | Instructor canonical key | Language match | Acceptance mode | LAW exercised |
|---|---|---|---|---|---|
| Day 1 | Confined + OW dive 1 | `stakeholders.instructor_1` (Ryan Clarke) | en / th | auto-accept (Ryan's `stakeholderPreferences.acceptanceMode = 'Auto'`) | LAW 1 |
| Day 2 | OW dives 2–3 | `stakeholders.instructor_3` (Wei Chen — cascade target) | zh-TW match for `customer_1` (Cluster B.3) | manual-accept (Wei Chen manual per Cluster F.2) | LAW 1 |
| Day 3 | OW dive 4 + AOW dive 1 | `stakeholders.instructor_2` (Li Ming) | zh-CN match for `customer_2` | auto-accept | LAW 1 |
| Day 4 | AOW dives 2–3 | `stakeholders.dive_master` (Arisa Kanchanaburi) — DM binding per J.3 | th / en | auto-accept (DM) | LAW 1 + LAW 2 (ratio rule) |
| Day 5 | AOW dives 4–5 | external free-text (Cluster B.2) — auto-confirmed per V1 Done Scene 2 | operator-declared | auto-confirmed (no cascade) | none |

**Cluster B.3 cascade — Day 2 binding:** Hug's `preferredInstructorSlugs` = `['ryan-clarke', 'wei-chen', 'li-ming']` (extends P0-12 seed update). On Day 2, booking picker tries Ryan #1 → Ryan's `teachingLanguages: ['en', 'th']` mismatches `customer_1.languages: ['zh-TW']` → cascade falls to Wei Chen #2 → Wei Chen's `teachingLanguages_completed: ['zh-CN', 'zh-TW', 'th', 'en']` matches → bind `Reservation.instructorId = wei-chen`. Asserted at `act_3_phase_1`.

**Gap-close events during Act II:**

- If a canonical entry has a `<field>_initial` / `<field>_completed` pair, the gap closes before Phase II.2 submits (the booking picker/completeness gate requires the completed state). Driver invokes the close-the-gap action per §7.12 skeleton table (e.g., `canonical.stakeholders.compressor_2.compressors.gasMixes_initial: []` → add `['air', 'nitrox']` via Gas Mixes tab). Customer gap: `customer_3.emergencyContact_initial: null` closes during Phase II.3 portal re-prompt.

**End-of-Act assertion (see `assertions.yaml#act_2_end`):** booking status = `Completed`; reservations table has one row per resource per day; no `AvailabilitySnapshot` drift; every `_initial` gap on a user touched by the booking has closed to `_completed`.

---

## Act III — Variation Matrix

Same booking shape as Act II, exercised across variation axes. Each axis is independent and must hold.

| Phase | Variation | Canonical reference | Min layer | Scene | Invariant | Assertion key |
|---|---|---|---|---|---|---|
| III.1 | Customer-language fallback (preferred instructor language mismatch → cascade to #2 in ordered preference) | customer.languages vs instructor_*.teachingLanguages | M | Cross-Cutting | **LAW 1** (#2 instructor's exclusive slot holds) | `act_3_phase_1` |
| III.2 | Channel variation (email vs WhatsApp vs SMS for portal invite) | customer_*.phone + .email | M + U | Cross-Cutting | none | `act_3_phase_2` |
| III.3 | Partial portal progress → reminder fires → resume from last-completed step | customer_* | M + U | **Scene 3** | none | `act_3_phase_3` |
| III.4 | Referral toggle mid-booking (agent creates, flips to referred DC → ownership + visibility re-compute) | `agent.defaultReferral` → `dive_center_1` | S + M | **Scene 12** | none | `act_3_phase_4` |

---

## Act IV — Branch Probes (in-spec unhappy paths that rejoin)

| Phase | Branch | Canonical reference | Min layer | Scene | Invariant | Assertion key |
|---|---|---|---|---|---|---|
| IV.1 | Medical hard block → operator contacts → resolve → resume | `customer_*.medicalFlag: true` | M + U | **Scene 6** | none (medical does not touch inventory) | `act_4_phase_1` |
| IV.2 | Resource decline → cascade down preference list → re-assign → rejoin spine | instructor_* ordered-preference list | S + M | **Scene 7** | **LAW 1** (reassigned instructor's exclusive slot transitions cleanly); **LAW 2** (pooled decrement on replacement) | `act_4_phase_2` |
| IV.3 | Language-fallback-after-mismatch (ordered-preference traversal) | instructor_*.teachingLanguages | M | Cross-Cutting | **LAW 1** | `act_4_phase_3` |
| IV.4 | Boat min-pax cancellation | `boat_1.vessels[].maxPax` threshold | S + M | **Scene 8** | **LAW 2** (boat pooled slots return on cancel) | `act_4_phase_4` |
| IV.5 | Customer no-show → status transition | customer_* | S + M | **Scene 9** | **LAW 3** (state-transition snapshot) | `act_4_phase_5` |
| IV.6 | TTL expiry on abandoned Draft | — | S + M | **Scene 10** | **LAW 3** | `act_4_phase_6` |
| IV.7 | Date blocking | — | S + M + U | **Scene 11** | none | `act_4_phase_7` |

---

## Act V — Post-Trip Conversion

| Phase | Action | Canonical reference | Min layer | Scene | Invariant | Assertion key |
|---|---|---|---|---|---|---|
| V.1 | Customer account creation prompt + prefill from portal data | `customer_*.customer.*` (prefill source) | S + U | Scene 5 | none | `act_5_phase_1` |
| V.2 | Review prompt fires | — | M + U | Scene 5 | none | `act_5_phase_2` |
| V.3 | First-repeat-use (customer logs in; prior booking visible + prefills for new booking) | customer_*, prior booking | S + U | — | none | `act_5_phase_3` |

---

## End-of-run assertions (see `assertions.yaml#run_end`)

- Every LAW (1, 2, 3) exercised at least once across all Acts. A LAW not exercised is a spec gap per §3.
- Every Scene 1–5 has a green phase.
- Every Scene 6–11 has a green phase in Act IV.
- Every in-scope canonical stakeholder has touched the booking at least once.
- Every `_initial` → `_completed` transition fired in Act II or III.

---

## Reference discipline

**Never inline literal values in this document.** When a phase needs a concrete value, reference the canonical key (e.g. `canonical.stakeholders.compressor_1.users.firstName`). The runtime resolves the reference against `canonical.json`. This prevents:

1. Drift between choreography and canonical data (value updated in one, stale in the other).
2. Dead-letter fixtures (a value committed here that no canonical entry owns).
3. Ambiguity about which stakeholder a value belongs to.

The only literal strings permitted are: canonical keys themselves, Scene names, Act/phase identifiers, LAW references, and UI-path descriptors (`/sign-in`, `/{slug}/{roleSlug}/dashboard`, tab names).
