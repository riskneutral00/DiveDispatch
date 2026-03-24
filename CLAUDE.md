# DiveDispatch

Multi-stakeholder booking platform for scuba diving. Operator stakeholder creates booking; resource stakeholders each confirm their slice. Customers complete a portal via tokenized link.

> **Scope:** Permanent architectural decisions, non-obvious business logic invariants, and project constraints only. Workflow how-tos, skill pointers, dev commands, and process steps do NOT belong here — put those in skills.

## Product Knowledge

All product decisions, domain rules, and business logic: `~/Desktop/DiveVault/DiveDispatch/`

## Dependency Direction

`convex/ ← lib/ ← components/ ← app/` — Never import upstream. (PostToolUse hook enforces this.)

## Proxy (not Middleware)

Next.js 16 renamed `middleware.ts` → `proxy.ts`. Auth proxy lives at `src/proxy.ts`. **Never create `src/middleware.ts`** — it conflicts and crashes the dev server. `.gitignore` blocks it.

## Auth Boundary

- **Clerk-authenticated mutations**: verify caller ownership via `users.slug`.
- **Customer portal**: tokenized BookingLink (UUID, no Clerk auth) — token IS the credential.

## Provider Nesting Order

`ClerkProvider > ConvexProviderWithClerk > ThemeProvider` — PostToolUse hook blocks wrong order.

## Mutation Patterns

All-or-nothing: any single conflict aborts entire mutation, zero partial holds. Decline releases inventory in the same mutation.

## Three Non-Negotiable Invariants

Any implementation that violates these is wrong:

1. No Exclusive-unit inventory held by more than one booking for any overlapping session window.
2. Pooled inventory decrements on hold placement; blocks only when count reaches zero.
3. All AvailabilitySnapshot updates occur in the same Convex mutation as the Reservation write.

## Session Lifecycle

Matt's workflow is 4 skills in order. Follow this cycle every session.

1. `/clerk-dev` — Sign in (Matt calls this)
2. `/status` — Resume context, prune TODOs, health check, start working (Matt calls this)
3. Work happens — Follow all CLAUDE.md rules. After completing any feature or bug fix, proactively generate tests using `/check` patterns (cheapest test type, DD fixtures, edge cases). Don't wait for `/check` to find the gap.
4. `/check` — Run tests, generate missing tests, reconcile TODOs, write specs for next session (Matt calls this)
5. `/vault` — Commit, capture observations, update memory (Matt calls this)

**TODO.md** (`~/Desktop/DiveVault/DiveDispatch/Product/TODO.md`) is the project roadmap. `/status` cleans it; `/check` updates it and specs the next items.

### Skill Registry

| Skill | Phase | Trigger |
|---|---|---|
| `/clerk-dev` | Session start | Matt calls manually |
| `/status` | After sign-in | Matt calls manually |
| `/check` | After work | Matt calls manually |
| `/vault` | Session end | Matt calls manually |
| `/youtube` | On-demand | Matt calls when needed |
| `/ui-ux-pro-max` | During work | Claude calls proactively for UI decisions |
| `/spec` | During work | Claude calls when user describes a new feature to build |
| `/design-review` | During work | Claude calls proactively after UI changes |
| `/review-backend-*` | Reference | Documentation for `/check`'s diff-scoped review |
| `/review-frontend` | Reference | Documentation for `/check`'s diff-scoped review |
| `/review-tests` | Reference | Documentation for `/check`'s test quality checks |

**Adding a new skill:** Classify it as one of:
- **Lifecycle** → fold into `/status`, `/check`, or `/vault`
- **During-work** → Claude calls proactively (add trigger rule to this table)
- **On-demand** → Matt calls when needed, outside lifecycle
- **Reference** → documentation that other skills consult, never called directly

## State Transitions

Non-obvious rules:

- **TTL is lazy expiry** — checked when a booking is read, not by scheduled cron. Draft + `expiresAt < now` → vacate reservations → set status to Cancelled.
- Default `holdTTL`: **12 hours (43200000 ms)**. Once Upcoming, TTL never applies.
- Medical block, auto-advance conditions → `DiveVault/DiveDispatch/Architecture/Architecture.md`

