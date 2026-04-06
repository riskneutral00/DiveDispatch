# Query Invariants

> Canonical rules for Convex queries and data access patterns. Referenced by CLAUDE.md and skills.
> Last updated: 2026-04-06

## Rules

1. **No `.collect()` without `.take(N)` or a documented bound.** Every `.collect()` call must either be preceded by `.take(N)` on the query chain, or have an inline comment explaining why the result set is bounded (e.g., `// bounded: max 12 roles per user`).
   - Enforced by: `/gate` flags `.collect()` without `.take()` or bound comment
   - Violation history: 107 unbounded `.collect()` calls across 28 backend files. `themes.ts:15` collected the entire table. `availability.ts:136,216` collected with no bounds.

2. **Client-provided limits are clamped to a server-side maximum.** No query accepts a client `limit` parameter and passes it through unchecked. Always: `Math.min(clientLimit, SERVER_MAX)`.
   - Enforced by: `/review-backend-mutations` flags `v.optional(v.number())` limit args without server clamping
   - Violation history: `notifications.ts:219` accepted client-provided `limit` with no server max. A caller could pass `limit: 999999`.

3. **Queries performing 3+ table joins on hot paths must be evaluated for a read-optimized projection.** Hot paths: dashboard, calendar, list views. The `availabilitySnapshots` pattern (write-time side-effect updating a summary table) is the canonical approach. Convex reactivity keeps projections fresh — no CDC infrastructure needed.
   - Enforced by: `/review-backend-mutations` flags new multi-join queries on hot paths
   - Existing projections: `availabilitySnapshots` (read-optimized view of reservation state)

4. **Projection tables are updated in the same mutation as their source.** If a mutation writes a reservation, it updates the availability snapshot in the same atomic mutation. No eventual consistency between source and projection.
   - Enforced by: `/review-backend-mutations` verifies co-location
   - Existing enforcement: Invariant 3 in CLAUDE.md ("All AvailabilitySnapshot updates occur in the same Convex mutation as the Reservation write")

5. **Read queries for different access patterns are separate functions.** A store-browsing query (metadata for display) is not the same as a config-loading query (full payload for rendering). Separate them.
   - Applies to: Theme store (`listStore` = metadata only, `getConfig` = full palette)
   - Pre-auth queries (no Convex connection yet) use localStorage cache of last-known state

## Exceptions

- `userRoles` per user — bounded by design (max ~12 roles). No `.take()` needed but document the bound.
- Internal helpers in `convex/lib/` that process bounded intermediate results may use `.collect()` with a bound comment.
