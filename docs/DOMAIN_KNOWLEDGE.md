# DiveDispatch — Domain Knowledge

> **What this document is:** Business context, stakeholder insights, and domain rationale that cannot be derived from code, schema, or git history. This is the "why" behind the system.
>
> **What this document is NOT:** Schema reference (see `convex/schema.ts`), architectural rules (see `CLAUDE.md`), or implementation details (see the codebase).
>
> **Origin:** Synthesized from domain expertise in dive operations and the DiveDispatch v0.1 codebase.

---

## TABLE OF CONTENTS

1. [Context & Vision](#section-1-context--vision)
2. [Domain Rationale](#section-2-domain-rationale)
3. [Booking Wizard & Portal Flows](#section-3-booking-wizard--portal-flows)
4. [Customer Portal Form Specs](#section-4-customer-portal-form-specs)
5. [Notification Trigger Table](#section-5-notification-trigger-table)
6. [Gap Analysis & Deferred Features](#section-6-gap-analysis--deferred-features)

---

## Section 1: Context & Vision

### What is DiveDispatch?

DiveDispatch is a **multi-stakeholder booking and operations platform** for the scuba diving industry. It is NOT a booking widget for one dive shop — it is the connective tissue between *every* business in the dive supply chain: the dive center that organizes dive trips, the instructor who teaches it, the boat that carries everyone, the equipment manager who packs the gear, the compressor that fills the tanks, and the customer who experiences it all.

**One booking flows through every stakeholder automatically:**
1. Customer contacts a dive center (or an agent) in-person or online
2. DC creates a booking → system checks boat availability, instructor match, equipment
3. Stakeholders accept/decline in real-time (or auto-accept)
4. Customer completes paperwork via tokenized portal link (no account needed)
5. Manifest auto-generates for the boat with seating recommendations
6. Equipment bags are digitally assigned and tracked
7. Post-dive: photos shared, dive log updated, upsell prompted

### Revenue Model: Purchasable Skins/Themes

The app's functionality is identical for every user. The **visual experience** is completely personalized through purchasable "skins" (themes). One user sees a mermaid-themed interface with ocean blues and flowing fonts. Another sees a sleek James Bond theme with golds and blacks. Another gets Hello Kitty pastels.

**Revenue streams from themes:**
- Free starter themes (onboarding)
- Paid one-time purchase themes
- Subscription themes (seasonal/rotating collections)
- Limited-edition drops (scarcity-driven)

**This is a core architectural requirement — not a cosmetic afterthought.** The entire component library must be built with theme-switching as a first-class concern from day one.

Future SaaS subscription revenue is planned but not in scope for initial build.

### Target Market

- **Phuket, Thailand and Taiwan first** (Matt's home markets, personal relationships with operators): 30+ dive centers, 20+ boats, 10+ liveaboards
- **Then:** All of Thailand
- **Then regional:** Philippines, Indonesia, Malaysia, Japan
- **Global:** $3B+ dive tourism market, same fragmentation everywhere

### The Liquid Glass Aesthetic

The UI is built on Apple Liquid Glass principles — a glassmorphism design language inspired by Ufinity Studio's "Liquid Glass Effect Sidebar UI" on Dribbble:

**Key CSS properties that define the aesthetic:**
- **Refractive glass panels:** `backdrop-filter: blur(12-20px)` over photo/gradient backgrounds
- **Luminous borders:** Semi-transparent borders (`rgba(255, 255, 255, 0.15-0.3)`) that catch light
- **Background color bleed-through:** Low-opacity background fills (`rgba` with 0.08-0.2 alpha) that let the underlying content/image tint the panel
- **Specular highlights:** Subtle inner glow or top-edge highlight simulating light refraction
- **Layered depth on active items:** Active/selected states use slightly higher opacity and stronger blur, creating a "raised glass" effect
- **Both dark and light mode:** Each theme defines both palettes from day one. Glass effects work on both — dark mode uses lighter glass borders, light mode uses darker ones

### UX References

- **Liquid Glass:** Ufinity Studio's "Liquid Glass Effect Sidebar UI" on Dribbble — refractive glass panel over photo background, luminous borders, background color bleed-through, specular highlights, layered depth on active item: https://dribbble.com/tags/apple-liquid-glass
- **Nav/Settings popover:** t3.chat's top-right icon button → compact popover with theme mode segmented control (light/system/dark icons in a pill) + toggle switches. For DiveDispatch: theme mode toggle + active skin preview + role switcher for multi-role users. Key principle: visual settings 1 click away, not buried in a settings page: https://t3.chat/

---

## Section 2: Domain Rationale

This section explains **why** schema and business rules are the way they are. The rules themselves live in `CLAUDE.md`; the schema lives in `convex/schema.ts`.

### Why 12 Stakeholder Roles?

**Organizers** (create bookings): DiveCenter, Agent, Liveaboard, DiveResort, DiveHostel, DiveSite
**Resources** (confirm participation): Instructor, DiveMaster, Boat, Equipment, Pool, Compressor

- **DiveMaster inherits Instructor's reservation path** (`resourceType: 'Instructor'`). DiveMasters guide dives but don't teach courses — their credential has no `courses` array. But from an inventory/booking perspective, they're booked identically to instructors.
- **DiveHostel inherits DiveResort's path.** A dive hostel is just a resort where diving is 99% of the business — no special system treatment needed.
- **Liveaboard and DiveSite are dual-role** — they're both organizers (can create bookings) and resources (other operators can book slots on them).

### Why Compressors Have 999999 Units

Compressor operators maintain an effectively infinite surplus of filled air cylinders. Nitrox fills need overnight prep but aren't capacity-limited in practice. The `totalUnits: 999999` model means compressors are a **confirmation/acceptance flow only** — no actual inventory checks. The value comes from the DC knowing which compressor to use and the compressor operator being in the booking communication loop.

### Why Single-Manager Strict-Fail for Equipment

Real-world equipment fulfillment: one EM packs one set of bags for a booking. Cross-EM fallback would mean split gear from two different shops arriving at two different piers — logistically impossible. If EM-A doesn't have enough XL BCDs, the DC selects a different EM or reduces quantity. No automatic fallback.

### Why Lazy TTL (No Cron)

Draft bookings expire after 12 hours by default. The expiry is checked lazily on read, not via a cron job. This means a Draft booking that nobody queries might "live" past its TTL — but the moment anyone reads it, it's cleaned up. This is simpler, cheaper, and avoids Convex cron complexity for something that doesn't need real-time precision.

### Why Cross-Owner Visibility is Limited

`AvailabilitySnapshot` exposes only `availableUnits` — never which booking owner holds a reservation. Any operator sees "unavailable" for a time window, but not "booked by [Owner X]." This prevents competitive intelligence leaking between dive centers.

### Hierarchical Stakeholder Ownership

One account can own multiple sub-stakeholders. Examples:
- Resort → DC → Boat + Equipment + Compressor
- DC → Boat + Equipment
- Boat Manager → multiple Boats (each with a Boat Master)

A dive resort that owns a DC behaves identically to a standalone DC in the system. Dashboard switcher lets the user navigate between sub-stakeholder views without logging out.

### Medical Block Rationale

Trigger: Customer answers "Yes" to any PADI physician-referral screening question (10 questions from PADI 10346). Effect: `medicalHardBlock = true` on booking → blocks Draft → Upcoming auto-advance. The `medical_block` flag persists on the customer record for cross-DC visibility — if a customer has a medical flag at DC-A, DC-B sees it too.

### Ban List Design

Silent, bidirectional: banned parties hidden from each other's pickers/search/directory. Bans do NOT affect existing bookings — only future visibility. This prevents awkward situations where a DC sees a banned instructor in their active booking list.

### Acceptance Modes

- **Auto:** Hold placed immediately; no stakeholder action required. Solves the "instructor is underwater" problem.
- **PrePayRequired / PostPayAllowed:** Behave identically to Auto until Stripe integration. Schema placeholders retained for future payment flow.

---

## Section 3: Booking Wizard & Portal Flows

### Booking Wizard Flow

1. **Details step:** Activity type (multi-select from course catalog), date range, per-diver info (name, abbreviation, country flag, dates, agency, per-diver activity types). Start with 1 diver, append more as needed.
2. **Resource assignment step:** Select Instructor, Boat, Equipment Manager, Pool (if confined day), Compressor from directory. Each can be "not in system" (external stakeholder freeform name). Auto-filter by language, location, availability.
3. **Portal link step:** Generate BookingLink with UUID token per diver. Send to customer (or customer fills at counter).

### Customer Portal Flow (4 steps)

1. **Contact:** Personal info, emergency contact, dive certification, basic health
2. **Medical:** PADI 10346 — 10 yes/no screening questions. "Yes" triggers physician referral
3. **Liability:** PADI 10086 — non-agency disclosure, liability release, signature, guardian section for under-18
4. **Equipment:** Body measurements (height, weight, shoe size), powered lenses, rental checklist (own/rent per item). Sizes are derived from measurements + EM's gear brands via `gearSizingLookup` — never self-reported.

### Course Catalog

The system supports agency-free activities and PADI courses:

**Agency-Free:**
- `TD` — Try Dive (1 day, 0 dives)
- `FD` — Fun Dive (1 day, 0 dives, addable as secondary)
- `Snorkel` — Snorkeling (1 day, 0 dives)

**PADI Courses:**
- `DSD` — Discover Scuba Diver (1 day, 1 dive, confined day)
- `OW` — Open Water (2+ days, 4 dives, confined day, dive sequence defined)
- `AOW` — Advanced Open Water (2+ days, 5 dives, required: Navigation + Deep, 3 electives)
- `OA` — Open Water + Advanced combo (4+ days, 9 dives, confined day)
- `Rescue` — Rescue Diver (2+ days, 4 dives)
- `DiveMaster` — Divemaster Course (2+ days, 6 dives)
- `Specialty` — Specialty Course (1+ days, 14 specialty options)

Each course defines: code, label, agencies, minDays, minDives, hasConfinedDay, credentialLabels, diveSequence (for multi-dive courses), specialtyOptions (for AOW/Specialty).

**AOW Specialty Options:** Navigation (required), Deep (required), Peak Performance Buoyancy, Night Dive, Search & Recovery, Dry Suit, Boat Dive, Altitude, Drift, Multilevel, Digital Underwater Photography, Underwater Naturalist, Wreck Dive.

DCs can configure booking preferences: `owDays` (default Open Water days), `aowDays`, `oaDays`, `aowSpecialties`.

### Key Domain Knowledge for Booking Implementation

- **BookingSessions: One row per resource per time slot.** A "morning dive" with 5 resources = 5 rows. UI abstracts this away.
- **Mixed courses per diver:** Common in group bookings (e.g., dad does FD, kid does DSD; or OW+AOW combo). Each diver has per-diver activity types. Booking-level `activityType` is a derived summary.
- **Portal links: One per diver.** Each diver gets their own `bookingLink` with a unique token.
- **Equipment bags:** Linked to instructor responsibility, not individual divers. Booking-level linking is sufficient.
- **AvailabilitySnapshots: Lazy creation.** `submitToDraft` creates a snapshot on first encounter in the same atomic mutation. No crons, no pre-generation.
- **Course catalog:** Static TypeScript file at `src/lib/constants/course-catalog.ts`.
- **Shore dive toggle:** On non-confined open water days, the booking wizard offers boat/shore toggle. Shore = no boat needed. Equipment delivery location auto-sets to "Beach" for shore, "Pool" for confined, "BoatPier" for boat sessions.

---

## Section 4: Customer Portal Form Specs

The customer portal is accessed via tokenized BookingLink (UUID). No account required. 4-step flow.

### Step 1: Contact Information

**Personal Information:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Legal First Name | text | Yes | |
| Legal Last Name | text | Yes | |
| Preferred Name | text | No | Nickname or preferred name |
| Email | email | Yes | |
| Phone | tel | Yes | International format: +1 555 000 0000 |
| Date of Birth | date | Yes | Used for age verification and manifest |
| Gender | select | Yes | Male, Female, Other |
| Nationality | select | Yes | Country list |

**Passport / ID:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Passport Number | text | Yes | Required for boat manifest |
| Issuing Country | select | Yes | Country list |
| Expiration Date | date | Yes | System warns if expiring within 6 months |

**Emergency Contact:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Emergency Contact Name | text | Yes | Full name |
| Emergency Contact Phone | tel | Yes | International format |
| Relationship to Diver | text | Yes | e.g. Spouse, Parent, Friend |

**Diving Certification:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Agency | select | Conditional | PADI, SSI, NAUI, BSAC, CMAS, None. Required for certified divers (fun dive, AOW, rescue, etc.), not required for uncertified (try dive, DSD, snorkel, OW). |
| Agency ID | text | Conditional | Same conditional requirement as Agency. |

**Health Information:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Known Allergies | textarea | No | Food, medication, environmental. Accept "None" |

### Step 2: Medical Questionnaire (PADI 10346)

**Intro text (display verbatim):**
> "Recreational scuba diving and freediving requires good physical and mental health. There are a few medical conditions which can be hazardous while diving. This questionnaire provides a basis to determine if you should seek out a physician's evaluation. Answer all questions honestly."

> **Note to women:** If you are pregnant, or attempting to become pregnant, do not dive.

**10 Yes/No Screening Questions (all required):**

| # | Question | Field Name |
|---|----------|------------|
| Q1 | I have had problems with my lungs/breathing, heart, blood, or have been diagnosed with COVID-19. | `medical_q1` |
| Q2 | I am over 45 years of age. | `medical_q2` |
| Q3 | I struggle to perform moderate exercise (walk 1.6 km/one mile in 14 minutes) or swim 200 m/yards without resting. | `medical_q3` |
| Q4 | I have had problems with my eyes, ears, or nasal passages/sinuses. | `medical_q4` |
| Q5 | I have had surgery within the last 12 months, or ongoing problems related to past surgery. | `medical_q5` |
| Q6 | I have lost consciousness, had migraine headaches, seizures, stroke, or significant head injury. | `medical_q6` |
| Q7 | I am currently undergoing treatment for psychological problems, panic attacks, or addiction. | `medical_q7` |
| Q8 | I have had back problems, hernia, ulcers, or diabetes. | `medical_q8` |
| Q9 | I have had stomach or intestine problems, including recent diarrhea. | `medical_q9` |
| Q10 | I am taking prescription medications (except birth control or anti-malarial drugs other than mefloquine). | `medical_q10` |

**Any "Yes" answer → `medicalHardBlock = true` on booking → blocks Draft → Upcoming until physician clearance uploaded.**

**Participant statement (display verbatim):**
> "I have answered all questions honestly, and understand that I accept responsibility for any consequences resulting from any questions I may have answered inaccurately or for my failure to disclose any existing or past health conditions."

### Step 3: Liability Release (PADI 10086)

**Non-Agency Disclosure:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| PADI Member / Store / Resort Name | text | Yes | Pre-filled from booking context |

Display Non-Agency Disclosure legal text verbatim (read-only scrollable block).

**Liability Release:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Participant Full Name | text | Yes | "I, ___________" format |

Display Liability Release legal text verbatim (read-only scrollable block).

**Acknowledgment:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Liability Acknowledgment | checkbox | Yes | "I have read and fully understand this Release of Liability / Assumption of Risk Agreement. I am of lawful age and legally competent to sign it of my own free act." |

**Diver Accident Insurance:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Has Diver Accident Insurance | radio (Yes/No) | No | |
| Policy Number | text | No | Only shown if "Yes" |

**Signatures:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Participant Signature | canvas (signature pad) | Yes | Touch/mouse draw; clear button |
| Date | date | Yes | |
| Parent / Guardian Name | text | Conditional | Required if under 18 |
| Parent / Guardian Signature | canvas | Conditional | Required if under 18 |

### Step 4: Equipment Sizing

> Equipment sizes (wetsuit, BCD, fins, etc.) are derived from body measurements + EM's gear brands via `gearSizingLookup` — never self-reported by the customer.

**Body Measurements:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Height (value) | number | No | e.g. 175 |
| Height (unit) | select | No | cm / in |
| Weight (value) | number | No | e.g. 70 |
| Weight (unit) | select | No | kg / lbs |
| Shoe Size (value) | text | No | e.g. 42 |
| Shoe Size (unit) | select | No | EU / US / CM |

**Powered Lenses:**

| Field | Type | Notes |
|-------|------|-------|
| Needs Corrective Lenses | radio (Yes/No) | |
| Prescription Details | textarea | e.g. "Left: -2.00, Right: -2.50". Only if Yes. |

**Equipment Rental Checklist (each item is "own" or "rent"):**

| Item | Values |
|------|--------|
| Mask | own / rent |
| BCD | own / rent |
| Wetsuit | own / rent |
| Fins | own / rent |
| Regulator | own / rent |

**Additional Notes:** Free-text textarea for special needs, preferences, material allergies.

---

## Section 5: Notification Trigger Table

Every notification is created inline by the mutation that triggers it (via a `notify()` helper — NOT a separate mutation). Notifications are stored in the `notifications` table with `readAt` initially undefined.

| Mutation | Type | Recipient | Template |
|----------|------|-----------|----------|
| submitToDraft | `hold_placed` | Each non-Auto resource owner | "New booking request for {activity} on {dates}" |
| submitToDraft (referral) | `booking_referred` | Agent | "{operator} referred a booking to you" |
| declineReservation | `hold_declined` | Booking owner | "{resource} declined your booking for {activity}" |
| declineReservation (no alt) | `no_backup_available` | Booking owner | "No alternative {type} available" |
| cancelBooking | `booking_cancelled` | Each resource owner | "{operator} cancelled booking for {activity}" |
| editBooking | `booking_updated` | Each resource owner | "{operator} is editing booking — reservation reset" |
| customerPortalSubmit (medical) | `medical_hard_block` | Booking owner | "Medical referral required for {name}" |
| clearPhysicianBlock | `physician_clearance_submitted` | Booking owner | "Physician clearance submitted for {name}" |
| complete-bookings cron (below minPax) | `min_pax_not_met` | Boat owner | "Trip on {date} has {current}/{min} passengers" |

---

## Section 6: Gap Analysis & Deferred Features

### Newly Discovered Features (from stakeholder interview)

**Architecture / Cross-cutting:**
1. Centralized `<Manifest>` component — reusable, role-based column visibility
2. Photo/media delivery to customers post-dive (tokenized link) — *deferred*
3. Booking continuation/upsell flow (try dive → course) — *deferred*
4. Transport/pickup logistics per customer on manifest

**Dive Center:**
5. Route-based boat selection (boat goes to specific dive sites on specific days)
6. Real-time seat availability on shared boats
7. Automated backup boat assignment on cancellation cascade
8. Instructor language + specialty auto-matching filter

**Boat Manager:**
9. Seating chart with AI recommendation algorithm + manual override
10. Boat Master sub-role (limited admin — seating power, not full manager)
11. Min-pax threshold with auto-cancel notification cascade
12. Multi-boat management dashboard

**Equipment Manager:**
13. Delivery location field per session (pool, beach, boat pier)

**Liveaboard:**
14. Real-time berth/cabin availability feed for agents
15. Trip schedule calendar (year-ahead planning)
16. Cross-boat booking transfer (upgrade to partner boat)
17. Per-boat cabin layout and type definitions
18. Equipment source per guest (own / DC-provided / rental)

**Customer:**
19. Day-by-day schedule view in customer portal (course students)
20. E-learning completion tracking as prerequisite — *deferred*
21. Post-course cert card tracking + dive log entry — *deferred*
22. Diver profile with cert history, preferences, saved operators (repeat users)
23. Location + dive site-based operator discovery

### Deferred Features

The following features are identified but deferred beyond the initial build:
- **Dive log / post-course tracking** — post-course cert card, dive log entries, completion records
- **Photo/media delivery** — post-dive photo/video sharing via tokenized link
- **E-learning completion tracking** — tracking PADI/SSI e-learning as a prerequisite
- **Booking continuation / upsell** — try dive → course upgrade, extending existing booking with preserved customer data

### Open Questions (Layer 5)

- Cross-boat booking transfer — when a liveaboard trip is under-filled, should the system automatically suggest partner boats, or is this a manual operator decision with system support?
- Equipment source tracking per guest (own / DC-provided / rental from liveaboard) — should this be a field on `customerProfiles` or a separate per-trip record?
- Transport logistics per customer (self-arranged / operator-provided / agent-arranged + flight numbers) — field on `customerProfiles` or separate table?

---

## Section 7: Architecture Decision Records

Irreversible or expensive-to-reverse architectural decisions are documented as formal ADRs in the vault at `Vaults/DiveDispatch/Architecture/ADR-*.md`. Each entry follows the format: Problem / Decision / Consequences / Status.

| ADR | Title | Summary |
|-----|-------|---------|
| ADR-001 | Portal Token as Credential | Customer portal uses UUID tokens instead of Clerk auth. Token IS the credential. No account creation required. |
| ADR-002 | Lazy TTL Expiry | Draft booking holds expire on read, not via cron. Simpler, cheaper, deterministic. |
| ADR-003 | Core vs Adapters Boundary | `convex/` divided into core (booking lifecycle), adapters (notifications, email, equipment), and shared (utilities). Strict import direction. |
| ADR-004 | Inventory/Availability Invariants | Three non-negotiable invariants enforced atomically: exclusive uniqueness, pooled decrement, and atomic snapshot+reservation writes. |

Full ADR files: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Architecture/`

---

**END OF DOMAIN KNOWLEDGE DOCUMENT**
