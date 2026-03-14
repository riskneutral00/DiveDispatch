# DiveDispatch — Domain Knowledge

> **What this document is:** Business context, stakeholder insights, and domain rationale that cannot be derived from code, schema, or git history. This is the "why" behind the system.
>
> **What this document is NOT:** Schema reference (see `convex/schema.ts`), architectural rules (see `CLAUDE.md`), or implementation details (see the codebase).
>
> **Origin:** AI-to-AI knowledge transfer from the DiveDispatch v0.1 codebase (31 tables, 419 commits, ~51K lines), synthesized with Matt's domain expertise as a dive instructor and former software developer.

---

## TABLE OF CONTENTS

1. [Context & Vision](#section-1-context--vision)
2. [Domain Rationale](#section-2-domain-rationale)
3. [Full Stakeholder Interview](#section-3-full-stakeholder-interview)
4. [Booking Wizard & Portal Flows](#section-4-booking-wizard--portal-flows)
5. [Customer Portal Form Specs](#section-5-customer-portal-form-specs)
6. [Notification Trigger Table](#section-6-notification-trigger-table)
7. [Gap Analysis & Deferred Features](#section-7-gap-analysis--deferred-features)

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

## Section 3: Full Stakeholder Interview

> **Date:** 2026-03-01 / 2026-03-02
> **Interviewer:** DiveDispatch (AI — businessman + technical lead)
> **Interviewee:** Matt (representing every stakeholder role)
> **Purpose:** Validate that the application solves real problems for every stakeholder. Identify gaps between current build and actual needs.

---

### 1. Dive Center

#### Context
Matt operates two dive centers with fundamentally different models:
- **DC-A (Full-service):** Owns boat, instructors, equipment, pool, compressor. Sets schedules directly.
- **DC-B (Storefront-only):** No owned resources. Coordinates with external boats, instructors, other stakeholders for every booking.

#### Pain Points
- **Scheduling coordination** across boats, instructors, and customers.
- **Marketing** and reaching tourists (language barriers, payment acceptance — cash only, no credit cards).
- **Route-based boat selection:** Different customer types (try dive vs. fun dive vs. AOW course) require different dive sites. Try-dive customers are restricted to safer areas (Ratchayai/Ratchanoi in Phuket). Fun dive and course customers go to Phi Phi or other destinations. Must find the specific boat going to the right route on that day.
- **Instructor matching:** Need instructors by language and specialty. Preferred instructors get priority, but when a customer needs a language or certification the preferred instructors don't have, must find alternatives fast.
- **Seat availability on shared boats:** Never knows capacity until calling the boat. Sometimes only a few seats left, and it's a race against other dive centers to grab them.
- **Last-minute boat cancellations:** Boat cancels due to insufficient customers, forcing a scramble to find a replacement boat with available seats.
- **Forgotten bookings:** More common than double-booking — forgetting a booking entirely or mixing up dates, resulting in no instructor arranged.
- **Paperwork:** Sometimes customers fill out forms at the shop before the dive. Sometimes the DC forgets entirely. Wants automated sending via booking link.
- **Agents:** Works with agents who send customers. Wants the system to handle agent referrals.

#### Key Decisions (Matt's Answers)
- Paperwork should auto-send via portal link at booking creation.
- Instructor language matching should auto-filter available instructors by customer's language need.
- Agent integration should support full handoff.

---

### 2. Instructor

#### Context
Freelance dive instructors in Thailand face unique challenges. Most would prefer steady work with one dive center, but DCs cherry-pick the best/cheapest instructors on demand. True freelancers like Matt are rare. Legally, instructors need a TAT (Tourism Authority of Thailand) license to advertise services — most freelancers who find their own customers are technically breaking the law, though it's extremely common.

#### Pain Points
- **Missed bookings while diving:** Underwater for hours with no cell reception. By the time they surface, the DC found someone else. This is the #1 pain.
- **Payment uncertainty:** Payment terms vary wildly by DC — same day (rare, best DCs), end of week (most), one or two months later (some), or never (DCs that go bankrupt).
- **No visibility into DC schedules:** An instructor doesn't know how a DC operates internally. Even instructors who want to work for a single DC get used only as emergency replacements because the DC has pick of the best/cheapest.
- **Last-minute cancellations:** Entire day of income lost with no notice.
- **Own customers are risky:** Finding your own customers means advertising (TAT license required). Very common but technically illegal without the license.

#### Key Decisions
- **Auto-accept:** System should auto-accept bookings with a configurable timeout (e.g., if instructor doesn't respond in X hours, auto-accept). Solves the underwater problem.
- **Cancellation policy:** System should enforce/display cancellation terms. Instructor needs to know as early as possible.
- **Own customers:** Instructors can book their own customers through the system. Booking owner = Instructor.

---

### 3. Boat Manager

#### Context
Operates multiple boats with different layouts. Works with many dive centers daily. Has a "Boat Master" (captain/first mate) who handles on-the-water operations including seating arrangements.

#### Pain Points
- **Filling the boat:** Empty seats are lost revenue. Needs visibility into demand from all DCs.
- **Minimum-pax threshold:** Each trip has a minimum. If not met, trip cancels. Cutoff is typically 6pm the day before.
- **Cancellation cascade:** When a boat cancels, DCs scramble. Even when the boat tells the DC in time, the DC doesn't always tell their instructors — instructors show up with equipment on the wrong boat the next day.
- **Desired solution:** Auto-assign a backup boat. Not just "tell the DC there's space elsewhere" but actually move the booking to the backup boat.
- **Seating chart complexity:** Each boat has a different layout. In the morning, the boat master assigns seating based on:
  - Diver experience (experienced near exit, beginners inside/out of the way)
  - DC grouping (sometimes an entire side belongs to one DC)
  - Mixed groups (5 different DCs — arrange by DC or by customer type)
  - Instructor preferences (some talk to the boat master directly to request a spot)
  - Ultimately the boat master has final say.
- **Wants an AI recommendation algorithm** for seating that considers diver type, but boat master has manual override authority.

#### Key Decisions
- Seating chart is a high-value feature with recommendation algorithm + manual override.
- Boat Master is a sub-role with different permissions than Boat Manager (seating authority, not full admin).
- Manifest is essential — every boat needs one showing all customers, their DC, instructor, pickup/dropoff, customer type, passport info.
- Backup boat auto-assignment on cancellation is a key differentiator.
- Multi-boat management dashboard for operators with more than one boat.

---

### 4. Equipment Manager

#### Context
The EM's main work is physical labor — packing bags, washing gear. Technology can help most with the daily logistics tracking.

#### Pain Points
- **Daily bag tracking:** Currently writes down by hand for each bag: which boat, which customer, which instructor. Tedious and error-prone.
- **Sizing:** Gets height, weight, shoe size from customers. Uses experience to know which sizes to pull from which manufacturers.
- **Gear return:** Instructors leave bags on boats. Boats deliver them back because they know which bags belong to which EM. Works but informal.
- **Gear mix-ups:** Instructors mix up gear with other customers' gear. Seemingly unavoidable.
- **Powered lenses:** Needs to know if customer needs powered lenses for their mask — not currently captured.
- **Delivery location varies:** Sometimes delivers bags to the boat pier, sometimes to the pool (for confined open water), sometimes to the beach.

#### Key Decisions
- **Digital bag ID system:** Each bag gets a number (e.g., "12345"). Digitally linked to customer + instructor + boat. Instructor checks the app to see which bag is theirs. Huge value.
- **Powered lenses** field needed on customer profile / booking.
- **Delivery location** field needed per session (pool, beach, boat pier).
- Inventory tracking (what's available, what's out) via real-time dashboard is useful.

---

### 5. Pool Operator

#### Pain Points
- Simple operation. Main need is knowing how many lanes are booked and when.

#### Key Decisions
- Lane booking with time slots is sufficient.
- No complex features needed beyond the basic calendar and availability view.
- Pool is often part of a hotel/resort — the pool operator is typically not a dive industry person.

---

### 6. Compressor Operator

#### Context
Extremely simple operation. Maintains an infinite surplus of filled air cylinders. Nitrox fills need a bit more time but can be done overnight. Trimix is very rare.

#### Pain Points
- Essentially none that technology solves. Customers drop off and pick up cylinders themselves.

#### Key Decisions
- A gas-mix catalog (air, nitrox, trimix) on the profile so DCs can see what's available is the only useful feature.
- Lowest-priority stakeholder in terms of feature depth.

---

### 7. Agent (Travel Agent)

#### Context
Sells dive packages globally — anywhere there's diving in the world. Biggest earner is selling liveaboard trips. Customers come primarily online (website, social media, travel platforms).

#### Pain Points
- **Coordinating availability** across multiple DCs and liveaboards — too many calls and chats.
- **Building accurate quotes** — prices change, add-ons vary, can never give an instant answer.
- **Managing customer paperwork** — each DC requires different forms.

#### Workflow
- **DC bookings: Full handoff.** Agent sends customer to DC and is done.
- **Liveaboard bookings: Direct coordination.** Messages/calls the liveaboard operator, relays availability to customer, back and forth until confirmed. No pre-allocated berths.
- **Global reach:** Sells diving everywhere in the world, not just one region.

#### Key Decisions
- Real-time liveaboard availability is the killer feature for agents.
- Agent profile should show which operators they work with.

---

### 8. Liveaboard Operator

#### Context
Runs multi-day dive trips. Schedules planned a year in advance with some flexibility. Almost entirely dependent on agents for bookings.

#### Pain Points
- **Filling the boat:** Each trip needs minimum guests to be profitable. Empty berths are lost revenue.
- **Agent sync:** Dozens of agents selling trips. Availability tracked via spreadsheet/notebook. First-come-first-served by phone — double-booking risk.
- **Logistics:** Provisioning, crew scheduling, equipment, route planning.
- **Cancellation handling:** Instead of canceling an under-filled trip, upgrades customers to a partner liveaboard running the same schedule. Cross-boat booking transfer.
- **Cabin types vary per boat.** Each liveaboard has its own layout and pricing structure.
- **Equipment:** Fair mix — some customers bring own gear, some have DC-provided gear, some rent directly from the liveaboard.
- **Passenger manifest:** Full manifest needed before departure — name, cert level, dive count, medical, emergency contact, passport (for some destinations).
- **Transport:** All of: self-arranged, operator-provided (hotel/airport transfers with flight numbers), or agent/DC-arranged. Needs to track per customer.

#### Key Decisions
- Real-time berth/cabin availability for agents is the highest-priority feature.
- Trip schedule calendar (year-ahead) with berth counts per trip.
- Cross-boat booking transfer for under-filled trips.
- Per-boat cabin layout and type definitions (shared, private, suite, etc.).
- Manifest with transport logistics is mandatory.
- Equipment source tracking per guest (own / DC-provided / rental).

---

### 9. Dive Resort

#### Context
50/50 split — some guests come for the resort, some exclusively to dive, some are spouses of divers. Dive hostels are a subset: 99% dive-focused.

#### Key Decisions
- Resort lodging management is NOT a DiveDispatch priority. Resorts may keep their own hotel software and use DD only for dive operations.
- Functionally, a dive resort that owns a DC behaves identically to a standalone DC in the system.
- Dive hostels are just resorts where diving is 99% of the business — no special treatment needed in the system.

---

### 10. Customers

#### 10a. First-Time Diver (Try Dive / Discover Scuba)

**Entry:** Walk-in off the street. Impulse decision while on vacation.
**Cares about:** Price, what's included, how long it takes. Quick decision.
**Paperwork:** Expects some (safety), but needs it to be fast.
**Post-dive:** Wants photos/videos as souvenirs. Photos sometimes come from the DC, sometimes from the instructor.
**Upsell opportunity:** If they loved it, they may want to continue into a full Open Water course over the next few days. The booking should support a "continue to course" flow — extending the existing booking, preserving paperwork and customer data.

#### 10b. Student Diver (Taking a Course)

**Decision factors:** Price, reviews/reputation, AND language (need instructor who speaks their language for a multi-day course). Shops around more carefully than try-divers.
**Biggest concern:** Schedule clarity — needs to know exactly when and where to show up each day (pool, boat, classroom). Day-by-day itinerary.
**E-learning:** PADI/SSI e-learning is common — students complete theory online before arriving, then do practical on-site. *(E-learning completion tracking — deferred)*
**Post-course needs:** Confirmation of completion, dive log of skills/dives completed, cert card info once issued, photos, and a path to book next dive trip as a newly certified diver. *(Dive log / post-course tracking — deferred)*

#### 10c. Certified Fun Diver

**Booking:** Walk-in the day before, ask what's going out tomorrow. Low friction.
**Cares about:** Which dive sites the boat is going to — this is the #1 factor.
**Gear:** Brings everything, just needs tank and weights.
**Buddy:** Doesn't care — flexible, DC handles pairing.

#### 10d. Repeat DiveDispatch User

**Retention hook:** Can rebook with preferred DC or instructor easily, or find a trusted operator at a new destination.
**Wants:** Full diver profile — cert level, dive log, preferences, saved operators, booking history.
**Discovery:** Search by location + dive sites — "Who goes to Richelieu Rock this week?"
**Account:** Yes — a full profile with social login or magic link. No passwords.

---

### Cross-Cutting Features Discovered

#### Centralized Manifest Component
A reusable `<Manifest>` component importable by any stakeholder dashboard. Shows all customers for a trip/boat/date. Columns include:
- Customer name, passport/ID, emergency contact
- Cert level, dive count, customer type (try dive, fun dive, course, etc.)
- Affiliated dive center and instructor
- Equipment source (own, DC-provided, rented)
- Pick-up and drop-off location + transport details
- Medical flags

**Role-based column visibility:**

| Role | Emphasis |
|------|----------|
| Boat Manager / Boat Master | Full manifest + seating chart integration |
| Liveaboard Operator | Full manifest + cabin assignments |
| Dive Center | Their customers only, for a given boat/date |
| Instructor | Their assigned customers only |
| Equipment Manager | Gear column + bag ID linkage |

#### Transport Logistics
Per-customer transport info on the manifest:
- Self-arranged
- Operator-provided (hotel pickup, airport transfer with flight number)
- Agent/DC-arranged
- Pick-up time and location
- Drop-off location

---

## Section 4: Booking Wizard & Portal Flows

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

## Section 5: Customer Portal Form Specs

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

## Section 6: Notification Trigger Table

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

## Section 7: Gap Analysis & Deferred Features

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

**END OF DOMAIN KNOWLEDGE DOCUMENT**
