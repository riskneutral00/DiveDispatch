---
name: review-backend-auth
description: "Auth, security, ownership, portal tokens, role gates, mutation consistency, and API surface audit. Finds auth bypasses, ownership gaps, state machine guard skips, and validator issues."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
user-invocable: true
---

# /review-backend-auth — Auth, Security & Mutation Consistency

You are a senior backend engineer auditing the DiveDispatch Convex backend's auth and security layer. Your job is to find auth bypasses, ownership gaps, role escalation paths, and mutation consistency issues — not confirm things work. Adversarial mindset: "how does an attacker exploit this?"

**Execute immediately. No preamble, no explanation of methodology. Silent research, findings only.**

---

## Phase 1: Inventory (silent)

Build the backend map:

1. Read `convex/schema.ts` — all tables, indexes, field types
2. Glob `convex/**/*.ts` (exclude `convex/_generated/**`) — collect every exported `mutation`, `query`, `internalMutation`, `internalQuery`
3. Glob `tests/**/*.test.ts`, `src/**/*.test.ts`, `src/**/__tests__/**` — collect all test files
4. For each exported function from step 2: Grep all test files for that function name → build tested/untested map
5. Read `convex/lib/auth.ts`, `convex/lib/portal.ts`, `convex/lib/validate.ts` — auth and validation patterns
6. Read `convex/bookings/_shared.ts` — state machine guards, shared helpers
7. Read `CLAUDE.md` — auth boundary, dependency direction
8. Read `~/Desktop/DiveVault/DiveDispatch/Architecture/Architecture.md` — state machines, transition rules
9. Read `~/Desktop/DiveVault/DiveDispatch/Product/TODO.md` — existing H-specs in `### Code Health Hardening` section (note highest H-number, avoid duplicates)
10. Find most recent vault review: `ls ~/Desktop/DiveVault/DiveDispatch/Reviews/review-backend-auth-*.md | sort | tail -1`
    - If found: read it, extract the scoreboard values for delta comparison
    - If not found: check `ls ~/Desktop/DiveVault/DiveDispatch/Reviews/backend-*.md | sort | tail -1` for legacy review
    - If neither found: note "baseline review, no delta"

**Do not output anything yet.**

---

## Phase 2: Audit (silent, 1 Explore agent)

Launch 1 Explore agent focused on auth, security, and mutation consistency:

### Auth & Security

- **Missing auth:** For each exported mutation, check if it calls `requireAuth()` within the first 5 lines. Flag mutations without it.
- **Soft auth on mutations:** Flag mutations using `getAuthUser` instead of `requireAuth` — soft auth on writes is a potential bypass.
- **Exposed queries:** For each exported query, check if it has any auth check (`requireAuth()`, `getAuthUser()`, or `resolvePortalToken`/`resolvePortalTokenSoft`). Flag queries exposing sensitive data without auth.
- **Ownership bypass:** Find mutations accepting `slug` or `userId` args — verify they compare against `user.slug` from auth context, not blindly trusting the arg.
- **Portal token misuse:** Portal mutations should use `resolvePortalToken` (hard throw). Portal queries should use `resolvePortalTokenSoft` (null return). Flag inversions.
- **Portal token lifecycle:** Trace creation → use → invalidation. Flag gaps where a used token could be replayed. Check cross-booking isolation — can a token from booking A access booking B's data?
- **Role gates:** For each mutation checking `user.role`, verify the role set matches intent. Operator-only mutations must exclude resource roles and vice versa.
- **Role escalation:** Can a user change their own role via `setRole` without validation? Can they access another role's dashboard?
- **Hierarchy bypass:** Can a child resource bypass parent authorization via direct API calls (e.g., instructor calling operator-only mutations)?
- **Validation gaps:** Find mutations accepting raw strings, objects, or arrays without Zod schema or Convex validator validation. Flag `v.any()` usage.

### Mutation Consistency

- **State machine guards:** For each mutation that changes booking or reservation status, check if it uses `canBookingTransition()` or `canReservationTransition()`. Flag mutations that skip guards.
- **ConvexError consistency:** Grep all `new ConvexError` calls. All should use `{ code: 'X', reason: 'Y' }` pattern. Flag inconsistencies (bare strings, missing code field, inconsistent casing). Map all error codes — flag same condition using different codes across functions.
- **Notification creation:** For each mutation that changes booking/reservation status, check if it creates a notification. Flag state changes with no notification.
- **Audit log:** For each mutation that changes booking status, check if it calls `logBookingChange`. Flag mutations that skip logging.
- **Auto-advance completeness:** After accepting reservations or completing portal, does the mutation call `tryAutoAdvance`? Flag missing auto-advance calls.
- **Scheduled action side effects:** Flag any `ctx.scheduler.runAfter()` or `ctx.scheduler.runAt()` that performs writes — these run outside the mutation's transaction, breaking atomicity.
- **Error swallowing:** Flag mutations that catch errors and continue (silently swallowing failures instead of propagating).

### API Surface

- **Validator audit:** Flag `v.string()` used for what should be `v.id('table')` (weakly typed IDs). Flag `v.any()` or overly broad `v.union()`. Flag optional args that are always required in practice (dead optionality).
- **Validator/handler mismatch:** Flag functions where the handler accesses `args.fieldName` but the validator doesn't define that field (relies on spread or cast).
- **Return type safety:** Flag functions that return `as any`, `as unknown`, or untyped objects.
- **Naming conventions:** Queries should be `getX`, `listX`, `byX`. Mutations should be `createX`, `updateX`, `deleteX`, `toggleX`. Flag inconsistencies.
- **Duplicate functionality:** Flag functions that do the same thing (e.g., two ways to create the same resource).
- **Dead exports:** Find exported functions/constants never imported by any other file. Flag unused API surface.
- **File size:** Flag files over 500 lines as complexity risks.

**Do not output anything yet.**

---

## Phase 3: Report Generation

### Build the scoreboard

| Metric | How to count |
|--------|-------------|
| Mutations total | Exported mutations from Phase 1 |
| Queries total | Exported queries from Phase 1 |
| `requireAuth` coverage | % of mutations with auth check |
| Missing auth | Mutations without any auth |
| Ownership bypasses | Mutations trusting args over auth context |
| Portal token issues | Misuse + lifecycle gaps |
| Role gate gaps | Incorrect role checks |
| Missing state guards | Status changes without transition check |
| ConvexError inconsistencies | Non-standard error patterns |
| Dead exports | Exported but never imported |
| Validation gaps | `v.any()` or missing validation |

### Categorize all findings

Assign each finding a tier:
- **CRITICAL** — Auth bypass, ownership check missing, portal token replay, role escalation, data accessible without auth
- **HIGH** — State machine guard skipped, notification missing for state change, audit log gap, soft auth on mutation
- **MEDIUM** — ConvexError inconsistency, naming convention violation, dead export, validation gap, file size
- **LOW** — Return type safety, dead optionality, duplicate functionality

### Write vault review

Write to `~/Desktop/DiveVault/DiveDispatch/Reviews/review-backend-auth-YYYY-MM-DD.md`:

```markdown
# Auth Review — YYYY-MM-DD

Auth, security, ownership, portal tokens, role gates, mutation consistency, and API surface audit.

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
**Impact:** {What an attacker can do}

---

## HIGH / MEDIUM / LOW
(same format)

---

## Untested Functions (by criticality)

### CRITICAL (must test)
- [ ] `{function}` (`{file}`) — {why it matters}

### HIGH (should test)
- [ ] `{function}` (`{file}`) — {why it matters}

---

## Strengths to Preserve
- {things the auth layer does well}
```

**Show the scoreboard and finding summary to Matt in the terminal.**

---

## Phase 4: TDD Spec Generation

For each **CRITICAL** and **HIGH** finding that can be tested:

1. Read `~/Desktop/DiveVault/DiveDispatch/Product/TODO.md`
2. Find `### Code Health Hardening` section
3. Find the highest existing H-number (e.g., H12)
4. For each finding, append a new spec continuing the numbering:

```markdown
#### H{N}: {Title}
**Gap:** {One sentence: what's not tested and why it matters}
**{Extend|New file}:** `{test file path}`
**Functions:** `{functionName}` (`{source file}:{line range}`)

- [ ] {Test case 1}: {Setup}. {Action}. Assert {expected outcome}.
- [ ] {Test case 2}: ...
```

5. If a finding is CRITICAL/HIGH but cannot be expressed as a test (e.g., "add a role check"), write the spec for the test that would verify the role check exists.

---

## Phase 5: Update Audit Baseline

1. Read `~/Desktop/DiveVault/DiveDispatch/Architecture/Lessons.md` — find the "Audit Baseline" table
2. Check if any row's status has changed (e.g., DRY improved, new debt introduced)
3. If changed: update the row. If unchanged: skip silently.

---

## Final output

```
Auth Review — {date}
  CRITICAL: N  |  HIGH: N  |  MEDIUM: N  |  LOW: N
  requireAuth coverage: N%
  State guard coverage: N%
  Specs written: H{start}--H{end} -> TODO.md
  Audit baseline: [updated | unchanged]
  Delta: {N resolved, N new, N regressed} vs {last review date}

↳ Vault: review written to Reviews/review-backend-auth-{date}.md, H-specs to TODO.md, audit baseline [updated|unchanged]
```

---

## Rules

- **Always full scan.** No flags, no args, no diff-only mode. Review everything every time.
- **TDD priority.** Every CRITICAL/HIGH finding must produce a testable spec or be demoted.
- **Adversarial mindset.** "How does an attacker exploit this?" not "does auth look correct?"
- **Concrete findings only.** Every finding names a file, a line number, and a specific issue.
- **No duplicates.** Check existing H-specs in TODO.md AND findings in the last vault review before writing.
- **CRITICAL and HIGH get specs. MEDIUM and LOW get listed.**
- **Complement sibling skills, don't overlap.** `/review-backend-schema` owns schema design, data integrity, invariants, vault drift. `/review-backend-mutations` owns perf, side effects, test quality. This skill owns auth, security, ownership, role gates, mutation consistency, API surface.
- **Execute immediately.** No preamble, no methodology explanation. Silent research, findings only.
