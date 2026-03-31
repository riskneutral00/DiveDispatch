---
name: review-prerequisite-gates
description: "Prerequisite gate bypass audit. Schema-first, field-by-field trace across all stakeholder roles. For every required field: form renders it, save mutation enforces it, completeness check includes it, booking gate blocks on it, indicator surfaces it."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
user-invocable: true
---

# /review-prerequisite-gates — Prerequisite Gate Bypass Audit

You are a senior QA engineer auditing the DiveDispatch system for **prerequisite gate bypass** bugs. This is a **schema-first, field-by-field** audit — not a gate-function review. You start from every required field in every stakeholder schema table and trace it through all 5 enforcement checkpoints.

Adversarial mindset: "for this specific field on this specific role, can a user leave it empty/invalid and still create a booking?"

**Execute immediately. No preamble, no explanation of methodology. Silent research, findings only.**

---

## The Five Checkpoints

For every required field on every stakeholder role, all 5 checkpoints must hold. A gap at any checkpoint is a finding.

| # | Checkpoint | Question | Severity if missing |
|---|---|---|---|
| 1 | **Form renders it** | Is this field present in the profile form, marked required, and impossible to submit without? | MEDIUM |
| 2 | **Save mutation enforces it** | Does the profile save mutation throw if this field is missing or empty? | HIGH |
| 3 | **Completeness check includes it** | Does `ROLE_REQUIRED` list this field? Does `checkProfileCompleteness` catch it when empty? | HIGH |
| 4 | **Booking gate blocks on it** | Does `createDraftShell` refuse to proceed when this field makes completeness < 100%? | CRITICAL |
| 5 | **Indicator surfaces it** | Does the profile completion banner/pill show this field as missing? Does the nav warn? | MEDIUM |

**Checkpoint 4 is the hard gate.** If the mutation doesn't throw, the prerequisite is not enforced — everything upstream is cosmetic.

### Depth rules for array/object fields

A field check is **shallow** if it only verifies the container exists or is non-empty. A field check is **deep** if it validates the content within. For each array/object field, determine if shallow is sufficient or if depth is required:

| Field | Shallow OK? | Deep check needed? |
|---|---|---|
| `credential` (array of objects) | NO | Must verify inner fields: `agency`, `level`, `agencyID`, `courses`. A credential with empty `courses` is incomplete. |
| `credential[].courses` (specialties) | NO | Must meet course-specific thresholds (e.g., AOW requires 5/5 specialties from `aowSpecialties.ts`) |
| `associations` (array) | YES | Non-empty is sufficient |
| `customerLanguages` / `teachingLanguages` | YES | Non-empty is sufficient |
| `fleet` (array of objects) | NO | Must verify inner fields: `routes[].diveSite` for open water capability |
| `locations` (Agent, array) | NO | Must verify `placeName`, `country` within first entry |

---

## Phase 1: Inventory — Build the Field Registry (silent)

### Step 1: Read all source-of-truth files

1. Read `convex/schema.ts` — extract every field definition for every stakeholder table: `diveCenters`, `instructors`, `diveMasters`, `agents`, `boats`, `equipment`, `pools`, `compressors`
2. Read `convex/lib/requiredFields.ts` — extract `PROFILE_REQUIRED`, `SETTINGS_REQUIRED`, `ROLE_REQUIRED` for every role
3. Read `convex/lib/profileCompleteness.ts` — understand exactly how `checkProfileCompleteness` evaluates each field (empty string? null? empty array? nested depth?)
4. Read `convex/shared/coverageValidation.ts` — `checkPreferenceCoverage()` requirements
5. Read `convex/lib/credentialMatch.ts` — `canTeachCourses()` logic
6. Read `convex/shared/aowSpecialties.ts` — mandatory specialties, total count requirements
7. Read `convex/bookingDraftMutations.ts` — `createDraftShell` guards (profile completeness + coverage)
8. Read `convex/bookings/create.ts` — `submitToDraft` guards and warnings
9. Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/CourseRules.md` — course prerequisite/dependency rules

### Step 2: Build the field registry

For each stakeholder role, enumerate **every** required field from both the schema definition and `ROLE_REQUIRED`. Include the shared layers too:

```
FIELD REGISTRY

Layer 0 — Profile (users table, all roles):
  firstName, lastName, email, phone

Layer 0 — Settings (users table, all roles):
  appLanguage

Layer 1 — DiveCenter:
  name, placeName, country, associations, customerLanguages
  + schema fields NOT in ROLE_REQUIRED but required by schema: {list any}

Layer 1 — Instructor:
  name, placeName, country, credential, teachingLanguages
  + nested: credential[].agency, credential[].level, credential[].agencyID, credential[].courses
  + depth: credential[].courses must cover AOW specialties (5/5) if offering AOW

Layer 1 — DiveMaster:
  name, placeName, country, credential, teachingLanguages

Layer 1 — Agent:
  name, placeName (from locations[0]), country (from locations[0]), associations

Layer 1 — Boat:
  name, placeName, diveSite (from fleet[].routes[]), fleet

Layer 1 — Equipment:
  name, placeName

Layer 1 — Pool:
  name, placeName

Layer 1 — Compressor:
  name, placeName
```

Flag any field that is required by the schema (`v.string()` not `v.optional(v.string())`) but NOT listed in `ROLE_REQUIRED` — this is a gap in the completeness check.

Flag any field in `ROLE_REQUIRED` that is NOT in the schema — this is dead config.

### Step 3: Read UI and indicator files

10. Glob `src/components/profiles/**/*.tsx` — collect all profile form components
11. Read `src/components/profiles/profile-completion-banner.tsx`
12. Read `src/components/profiles/profile-completion-pill.tsx`
13. Grep for `createDraftShell` in `src/` — find the booking creation UI entry point
14. Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md` — existing H-specs (note highest H-number)
15. Find most recent vault review: `ls ~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/review-prerequisite-gates-*.md | sort | tail -1`

**Do not output anything yet.**

---

## Phase 2: Field-by-Field Trace (silent, parallel agents by role group)

Launch **3 parallel agents**, each responsible for tracing fields through all 5 checkpoints for a subset of roles:

### Agent A — Operator roles: DiveCenter, Agent

For each required field on DiveCenter and Agent:

1. **Form renders it:** Find the profile form component for this role. Grep for the field name. Is it rendered? Is it marked required? Can the form be submitted with this field empty?
2. **Save mutation enforces it:** Find the mutation that saves this role's profile (grep for the table name + `ctx.db.patch` or `ctx.db.insert`). Does it validate this field before writing? Does it throw if empty?
3. **Completeness check includes it:** Is this field in `ROLE_REQUIRED` for this role? In `checkProfileCompleteness`, what does "empty" mean for this field type — empty string? null? empty array? Does the check match?
4. **Booking gate blocks on it:** Trace from `checkProfileCompleteness` → `createDraftShell`. If this field is empty, does completeness drop below 100%? Does `createDraftShell` throw?
5. **Indicator surfaces it:** Does the profile completion banner list this field when it's missing? Does the pill show < 100%?

**Special attention for DiveCenter:**
- `associations` array — is non-empty sufficient, or do specialties within matter?
- `customerLanguages` — non-empty check vs. specific language requirements

**Special attention for Agent:**
- `locations[0].placeName` and `locations[0].country` — does the completeness check correctly extract from nested array?

### Agent B — Resource roles: Instructor, DiveMaster, Boat

Same 5-checkpoint trace for each required field.

**Special attention for Instructor/DiveMaster:**
- `credential` array — the Hug Ocean bug class. Trace the FULL depth:
  - Does `ROLE_REQUIRED` just check `credential` is non-empty?
  - Or does it check `credential[].courses` has entries?
  - Or does it check `credential[].courses` meets specific thresholds (5/5 AOW specialties)?
  - What does `canTeachCourses()` require vs. what `checkProfileCompleteness()` checks?
  - Is `canTeachCourses()` called as a hard gate (throw) or soft warning (log)?
- `teachingLanguages` — non-empty check

**Special attention for Boat:**
- `fleet` array — does completeness check validate `fleet[].routes[].diveSite` exists?
- `diveSite` extraction — is the nested path correct?

### Agent C — Support roles: Equipment, Pool, Compressor + Cross-cutting

Same 5-checkpoint trace for Equipment, Pool, Compressor fields.

**Plus cross-cutting audit:**
- **Shared layer (Layer 0):** Trace `firstName`, `lastName`, `email`, `phone`, `appLanguage` through all 5 checkpoints. These apply to ALL roles — one gap here affects everyone.
- **Bypass paths:** Can any role reach `createDraftShell` through an alternative path that skips the completeness check? Check:
  - `createReferralDraftShell` — does it have the same guards?
  - Direct API calls — are mutations exposed without UI gating?
  - Scheduled actions — do any auto-create bookings without completeness checks?
- **Preference coverage vs. profile completeness:** These are two separate gates in `createDraftShell`. Trace whether BOTH are checked, or if passing one skips the other.

**Do not output anything yet.**

---

## Phase 3: Build Enforcement Matrix (silent)

Compile all agent findings into a single matrix. One row per field per role, one column per checkpoint:

```
Role         | Field                    | 1. Form | 2. Save | 3. Completeness | 4. Booking Gate | 5. Indicator | Notes
-------------|--------------------------|---------|---------|-----------------|-----------------|--------------|------
ALL          | firstName                |    ?    |    ?    |        ?        |        ?        |      ?       |
ALL          | lastName                 |    ?    |    ?    |        ?        |        ?        |      ?       |
ALL          | email                    |    ?    |    ?    |        ?        |        ?        |      ?       |
ALL          | phone                    |    ?    |    ?    |        ?        |        ?        |      ?       |
ALL          | appLanguage              |    ?    |    ?    |        ?        |        ?        |      ?       |
DiveCenter   | name                     |    ?    |    ?    |        ?        |        ?        |      ?       |
DiveCenter   | placeName                |    ?    |    ?    |        ?        |        ?        |      ?       |
DiveCenter   | country                  |    ?    |    ?    |        ?        |        ?        |      ?       |
DiveCenter   | associations             |    ?    |    ?    |        ?        |        ?        |      ?       |
DiveCenter   | customerLanguages        |    ?    |    ?    |        ?        |        ?        |      ?       |
Instructor   | name                     |    ?    |    ?    |        ?        |        ?        |      ?       |
Instructor   | credential               |    ?    |    ?    |        ?        |        ?        |      ?       |
Instructor   | credential[].courses     |    ?    |    ?    |        ?        |        ?        |      ?       | DEPTH CHECK
Instructor   | AOW specialties (5/5)    |    ?    |    ?    |        ?        |        ?        |      ?       | DEPTH CHECK
...          | ...                      |   ...   |   ...   |       ...       |       ...       |     ...      |
```

Mark each cell:
- **E** = Enforced (hard throw or required field)
- **S** = Soft (warning, log, or disabled button only)
- **M** = Missing (no check at all)
- **N/A** = Not applicable (with justification)
- **SHALLOW** = Check exists but only validates container, not contents

Any cell that is **S**, **M**, or **SHALLOW** is a finding.

**Do not output anything yet.**

---

## Phase 4: Report Generation

### Build the scoreboard

| Metric | How to count |
|--------|-------------|
| Roles audited | Count of stakeholder roles |
| Fields traced | Total rows in enforcement matrix |
| Total checkpoints | Fields × 5 |
| Fully enforced (all 5 = E) | Green rows |
| Partially enforced (mix of E and gaps) | Yellow rows |
| Unenforced (0 checkpoints = E) | Red rows |
| Shallow checks (depth insufficient) | SHALLOW cells |
| Soft gates (warning not throw) | S cells |
| Missing checks | M cells |
| Bypass paths found | Alternative code paths skipping gates |

### Severity classification

- **CRITICAL** — Booking gate (checkpoint 4) is **M** or **S**. Stakeholder can create a booking with this field empty/invalid. The Hug Ocean bug class.
- **HIGH** — Completeness check (checkpoint 3) is **M** or **SHALLOW**. `checkProfileCompleteness` returns 100% when it shouldn't. Gate would pass a broken profile.
- **MEDIUM** — Indicator (checkpoint 5) is **M**. User isn't warned about the missing field, but mutation would catch it. Also: Form (checkpoint 1) renders field but doesn't mark it required.
- **LOW** — Save mutation (checkpoint 2) allows persisting incomplete data, but downstream gate catches it.

### Write vault review

Write to `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/review-prerequisite-gates-YYYY-MM-DD.md`:

```markdown
# Prerequisite Gate Review — YYYY-MM-DD

Schema-first, field-by-field prerequisite gate bypass audit across all stakeholder roles.

---

## Scoreboard

| Metric | Value | Delta from last |
|--------|-------|-------------|
| ... | ... | ... |

## Enforcement Matrix

| Role | Field | Form | Save | Completeness | Booking Gate | Indicator | Severity |
|---|---|---|---|---|---|---|---|
| ... | ... | E/S/M | E/S/M | E/S/M/SHALLOW | E/S/M | E/S/M | ... |

(Only show rows with at least one non-E cell. Fully enforced rows → count in scoreboard, omit from table.)

## Delta from Last Review

### Resolved
- {finding from last review that is now fixed}

### New
- {finding not in last review}

### Regressed
- {finding that got worse since last review}

---

## CRITICAL

### {N}. {Title}
**Role:** {stakeholder role}
**Field:** {field name}
**Checkpoint gap:** {which checkpoint(s) failed}
**Bypass:** {Exact steps: save profile with field X empty → create booking → booking created despite missing X}
**Impact:** {What the user can do that they shouldn't be able to}
**File refs:** {file:line for each gap}

---

## HIGH / MEDIUM / LOW
(same format, with **Gap:** instead of **Bypass:**)

---

## Bypass Paths
- {Alternative code paths that skip prerequisite checks}

---

## Strengths to Preserve
- {prerequisite enforcement patterns that work well — name the specific fields/roles}
```

**Show the scoreboard, enforcement matrix (gaps only), and finding summary to Matt in the terminal.**

---

## Phase 5: Test Generation

For each **CRITICAL** and **HIGH** finding, write a **failing test** that proves the gap exists.

### Test placement rules

- Completeness definition gaps (checkpoint 3) → extend `tests/profileCompleteness.test.ts`
- Booking gate gaps (checkpoint 4) → extend or create `tests/bookingDraftMutations.test.ts`
- Credential depth gaps → extend `tests/credentialMatch.test.ts`
- New cross-cutting gaps → create `tests/prerequisiteGates.test.ts`

### Test format

Follow existing `convex-test` patterns:

```typescript
describe('prerequisite gate: {Role} — {field}', () => {
  it('{field} empty/invalid must make completeness < 100% — currently passes', async () => {
    await t.run(async (ctx) => {
      // Setup: seed a {Role} profile with all fields complete EXCEPT {field}
      const userId = await seedUser(ctx, { role: '{Role}' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seed{Role}Profile(ctx, userId, {
        // all fields filled, but {field} is empty/invalid
        {field}: {empty value — '' or [] or missing nested content},
      })

      // Assert: completeness must be < 100%
      const result = await checkProfileCompleteness(ctx, { _id: userId }, '{Role}')
      expect(result.percentage).toBeLessThan(100)
      expect(result.incomplete).toContain('{field}')
    })
  })

  it('{field} empty/invalid must block booking creation — currently allowed', async () => {
    // Only if this is a CRITICAL finding (checkpoint 4 gap)
    // Setup: create user with incomplete {field}, attempt createDraftShell
    // Assert: mutation throws PROFILE_INCOMPLETE
  })
})
```

### Depth-specific tests (the Hug Ocean class)

```typescript
describe('prerequisite gate: Instructor — credential depth', () => {
  it('credential with 4/5 AOW specialties must make completeness < 100%', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Instructor' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedInstructorProfile(ctx, userId, {
        credential: [{
          agency: 'PADI',
          level: 'Open Water Scuba Instructor',
          agencyID: '550453',
          courses: ['Navigation', 'Deep', 'Buoyancy', 'Naturalist'], // 4/5, missing 1
        }],
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Instructor')
      // This SHOULD fail (< 100%) but currently passes because check is shallow
      expect(result.percentage).toBeLessThan(100)
    })
  })
})
```

### Test intent

- Tests are **TDD red phase** — they MUST FAIL against current code
- Test names describe the CORRECT behavior, suffixed with "— currently {bypassed|passes|allowed}"
- Each test maps to exactly one finding in the enforcement matrix

### What NOT to test

- Don't test form rendering or indicators (Playwright territory)
- Don't test fields where all 5 checkpoints are enforced
- Focus on checkpoints 3 (completeness) and 4 (booking gate)

---

## Phase 6: Ticket Creation

For each **CRITICAL** and **HIGH** finding:

1. Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md`
2. Find `### Code Health Hardening` section, note highest H-number
3. Append TDD spec:

```markdown
#### H{N}: {Role} — {field} prerequisite gate bypass
**Gap:** {One sentence: field X on role Y is not enforced at checkpoint Z, allowing booking creation with invalid state}
**{Extend|New file}:** `{test file path}`
**Functions:** `checkProfileCompleteness` (`convex/lib/profileCompleteness.ts`), `createDraftShell` (`convex/bookingDraftMutations.ts`)

- [ ] {field} empty → completeness < 100%. Assert `incomplete` array contains `{field}`.
- [ ] {field} empty → `createDraftShell` throws `PROFILE_INCOMPLETE`.
- [ ] (if depth gap) {field} with partial content (e.g., 4/5 specialties) → completeness < 100%.
```

4. Create ticket via `/board create` referencing the H-spec and the specific failing test.

---

## Phase 7: Vault

Write review to vault (done in Phase 4).

Update `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Architecture/Lessons.md` audit baseline if applicable.

---

## Final output

```
Prerequisite Gate Review — {date}
  CRITICAL: N  |  HIGH: N  |  MEDIUM: N  |  LOW: N
  Roles: N audited
  Fields: N traced, N fully enforced, N with gaps
  Checkpoints: N/N passing (N shallow, N soft, N missing)
  Bypass paths: N found
  Tests written: N failing tests in {file(s)}
  Specs written: H{start}--H{end} -> TODO.md
  Tickets created: DD-{N}, DD-{N}, ...
  Delta: {N resolved, N new, N regressed} vs {last review date}

↳ Vault: review written to Reviews/review-prerequisite-gates-{date}.md, H-specs to TODO.md
```

---

## Rules

- **Schema-first.** Start from schema tables, not from gate functions. Enumerate every field, then trace it.
- **Field-by-field.** Every required field gets its own row in the matrix. No field is skipped.
- **Depth over breadth.** A "non-empty array" check on a field that requires content validation is a SHALLOW finding. The Hug Ocean bug (4/5 specialties passing) is the canonical example.
- **All roles, every time.** Audit all 8 stakeholder roles + shared layers. No sampling.
- **TDD priority.** Every CRITICAL/HIGH finding must produce a failing test AND a testable spec, or be demoted.
- **Adversarial mindset.** "For this field on this role, can I leave it empty and create a booking?" — not "does the check look reasonable?"
- **Concrete findings only.** Every finding names a role, a field, which checkpoint(s) failed, the file:line, and the exact bypass.
- **No duplicates.** Check existing H-specs in TODO.md AND findings in the last vault review before writing.
- **CRITICAL and HIGH get tests + specs. MEDIUM and LOW get listed.**
- **Mutation is the gate.** UI-only enforcement is not enforcement. If the mutation doesn't throw, it's a finding.
- **Complement sibling skills, don't overlap.** `/review-backend-auth` owns auth bypasses and role gates. `/review-backend-schema` owns schema design and invariants. This skill owns field-level prerequisite enforcement: is every required field enforced at every checkpoint?
- **Execute immediately.** No preamble, no methodology explanation. Silent research, findings only.
