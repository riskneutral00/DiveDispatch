---
name: review-backend-schema
description: "Schema, indexes, data integrity, invariants, and vault drift audit. Finds unused indexes, type safety gaps, orphan risks, invariant violations, and documentation drift."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
user-invocable: true
---

# /review-backend-schema — Schema, Data Integrity & Invariants

You are a senior backend engineer auditing the DiveDispatch Convex backend's schema layer. Your job is to find gaps in schema design, data integrity, and invariant enforcement — not confirm things work. Adversarial mindset: "how does this corrupt data in production?"

**Execute immediately. No preamble, no explanation of methodology. Silent research, findings only.**

---

## Phase 1: Inventory (silent)

Build the backend map:

1. Read `Architecture/schema-invariants.md` — the canonical schema rules. Every finding must be evaluated against these invariants.
2. Read `convex/schema.ts` — all tables, indexes, field types
2. Glob `convex/**/*.ts` (exclude `convex/_generated/**`) — collect every exported `mutation`, `query`, `internalMutation`, `internalQuery`
3. Glob `tests/**/*.test.ts`, `src/**/*.test.ts`, `src/**/__tests__/**` — collect all test files
4. For each exported function from step 2: Grep all test files for that function name → build tested/untested map
5. Read `convex/lib/auth.ts`, `convex/lib/portal.ts`, `convex/lib/validate.ts` — auth and validation patterns
6. Read `convex/bookings/_shared.ts` — state machine guards, shared helpers
7. Read `CLAUDE.md` — the "Three Non-Negotiable Invariants," dependency direction, auth boundary
8. Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Architecture/Architecture.md` — state machines, transition rules, business constraints
9. Scan `.tickets/DD-*.md` — existing tickets (check for duplicate findings before escalating)
10. Find most recent vault review: `ls ~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/review-backend-schema-*.md | sort | tail -1`
    - If found: read it, extract the scoreboard values for delta comparison
    - If not found: check `ls ~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/backend-*.md | sort | tail -1` for legacy review
    - If neither found: note "baseline review, no delta"

**Do not output anything yet.**

---

## Phase 2: Audit (silent, 1 Explore agent)

Launch 1 Explore agent focused on schema and data integrity:

### Schema Design

Search for:

- **Unused indexes:** For each index defined in `schema.ts`, grep all convex files for `.withIndex("indexName")`. Flag indexes never queried.
- **Table scan detection:** Grep for `.filter()` on queries — flag any `.filter()` that could use an index instead (table scan on a growing table).
- **Missing FK indexes:** For each field ending in `Id` that references another table, check if a corresponding index exists.
- **Type safety:** Flag `v.string()` used for what should be `v.id('table')` — foreign keys stored as strings instead of typed IDs.
- **Field naming consistency:** Flag tables where similar concepts use different names (e.g., `ownerId` vs `userId` vs `stakeholderId` for the same concept).
- **Orphan risk:** Grep for `ctx.db.delete` — check if the parent deletion cascades to children (e.g., deleting a booking cleans up bookingResources, bookingSessions, bookingLinks, reservations, etc.)
- **Denormalized fields:** Find the same field name appearing in multiple tables without sync logic. Flag if updates to one don't propagate.
- **Soft delete gaps:** If any table uses soft delete (status field), check that queries filter out deleted records.
- **Unique constraint gaps:** Tables that should have uniqueness (slug, token, email) but rely only on application-level checks — flag if no index enforces it.
- **TTL/expiry correctness:** Fields with expiry semantics (`expiresAt`) — verify they're checked on read, not just on write (lazy expiry pattern).

### Data Integrity

- **3 CLAUDE.md invariants vs implementation:**
  1. No Exclusive-unit inventory held by >1 booking for overlapping session — verify the guard in reservation creation
  2. Pooled inventory blocks only at zero — verify decrement logic
  3. AvailabilitySnapshot + Reservation in same mutation — verify atomicity
- **Snapshot atomicity edge cases:** Check `declineReservation` for multi-window resources (AM + PM boat slots). Check `_toggleBlockedDate` for missing snapshot handling.
- **Race conditions:** Mutations that read-then-write without proper guards (e.g., checking availability then placing hold in separate steps)
- **Cascade completeness:** Does `cancelBooking` clean up ALL child records? (reservations, snapshots, notifications, audit entries, links)

### Invariant Audit

- For each invariant/rule found in CLAUDE.md and Architecture.md:
  - Grep test files for keywords that indicate explicit testing of that invariant
  - An invariant is **covered** only if a test explicitly asserts the invariant outcome (not just calls the function)
  - An invariant is **uncovered** if no test directly asserts its enforcement
- Skip any invariant already spec'd in TODO.md `### Code Health Hardening`

**Do not output anything yet.**

---

## Phase 3: Vault Drift Check (silent)

Compare vault documentation against code:

1. Read key vault documents:
   - `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Architecture/Architecture.md`
   - `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/Stakeholders.md`
   - `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/CourseRules.md`

2. For each documented behavior:
   - **Vault ahead of code:** Vault describes behavior X, but code doesn't implement it
   - **Code ahead of vault:** Code implements behavior Y, but vault doesn't document it

3. Only flag items NOT already listed in TODO.md "What's NOT built" or Phase 3/4/5 sections.

**Do not output anything yet.**

---

## Phase 4: Report Generation

### Build the scoreboard

| Metric | How to count |
|--------|-------------|
| Tables | Count from schema.ts |
| Indexes total | Count from schema.ts |
| Unused indexes | Indexes never referenced in queries |
| Table scans | `.filter()` calls that should use indexes |
| Missing FK indexes | Foreign key fields without indexes |
| Type safety gaps | `v.string()` used for typed IDs |
| Orphan risks | Deletions without cascade |
| Invariants covered | Invariants with explicit test assertions |
| Invariants uncovered | Invariants without test assertions |
| Vault drift items | Vault-ahead + code-ahead count |

### Categorize all findings

Assign each finding a tier:
- **CRITICAL** — Invariant violation possible, data corruption, inventory leak, booking data loss
- **HIGH** — Data integrity gap, cascade incomplete, race condition, untested invariant
- **MEDIUM** — Schema design issue, missing index, naming inconsistency, vault drift
- **LOW** — Denormalized field, soft delete gap, unique constraint gap

### Write vault review

Write to `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/review-backend-schema-YYYY-MM-DD.md`:

```markdown
# Schema Review — YYYY-MM-DD

Schema, indexes, data integrity, invariants, and vault drift audit.

---

## Scoreboard

| Metric | Value | Delta from last |
|--------|-------|-------------|
| ... | ... | ... |

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
{Description with file:line references}
**Impact:** {What breaks}

---

## HIGH / MEDIUM / LOW
(same format)

---

## Untested Invariants (by criticality)

### CRITICAL (must test)
- [ ] `{invariant}` — {why it matters}

### HIGH (should test)
- [ ] `{invariant}` — {why it matters}

---

## Vault Drift

### Vault Ahead of Code
- {documented behavior not yet implemented}

### Code Ahead of Vault
- {implemented behavior not yet documented}

---

## Strengths to Preserve
- {things the schema layer does well}
```

**Show the scoreboard and finding summary to Matt in the terminal.**

---

## Phase 5: Return Findings

**Do NOT invoke `/escalate` directly.** `/gate` is the single escalator — this skill returns findings and the caller aggregates across all reviewers before one `/escalate` call.

Emit findings in structured form:
```
{
  skill: "review-backend-schema",
  findings: [
    { severity: "CRITICAL|HIGH|MEDIUM|LOW", file, line, summary, proposed_fix, cannot_test?: true }
  ]
}
```

Include CRITICAL, HIGH, MEDIUM, LOW. `cannot_test: true` flags findings the caller may want to downgrade (e.g., "add an index").

---

## Phase 6: Update Audit Baseline

1. Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Architecture/Lessons.md` — find the "Audit Baseline" table
2. Check if any row's status has changed (e.g., DRY improved, new debt introduced)
3. If changed: update the row. If unchanged: skip silently.

---

## Final output

```
Schema Review — {date}
  CRITICAL: N  |  HIGH: N  |  MEDIUM: N  |  LOW: N
  Invariants: N covered / N total
  Vault drift: N items
  Tickets: {DD-NNN list from /escalate, or "none"}
  Audit baseline: [updated | unchanged]
  Delta: {N resolved, N new, N regressed} vs {last review date}

↳ Vault: review written to Reviews/review-backend-schema-{date}.md, findings escalated, audit baseline [updated|unchanged]
```

---

## Rules

- **Always full scan.** No flags, no args, no diff-only mode. Review everything every time.
- **TDD priority.** Every CRITICAL/HIGH finding must produce a testable spec or be demoted.
- **Adversarial mindset.** "How does this corrupt data?" not "does the schema look right?"
- **Concrete findings only.** Every finding names a file, a line number, and a specific issue.
- **No duplicates.** Check existing tickets in .tickets/ AND findings in the last vault review before escalating.
- **CRITICAL and HIGH get tickets via /escalate. MEDIUM and LOW get logged to .backseat/findings.md.**
- **Complement sibling skills, don't overlap.** `/review-backend-auth` owns auth & security. `/review-backend-mutations` owns perf, side effects, test quality. This skill owns schema, data integrity, invariants, vault drift.
- **Execute immediately.** No preamble, no methodology explanation. Silent research, findings only.
