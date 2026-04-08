# Enterprise Invariants (LAW)

Production-readiness rules enforced by hooks, pre-commit gates, and CI pipelines.
Each rule lists its enforcement mechanism — if the mechanism doesn't exist yet, it's flagged.

## E1. Structured logging only in convex/

All `convex/` files must use `log.*` from `convex/lib/logger.ts`.
`console.error`, `console.log`, `console.warn` are banned.

**Enforced by:** PostToolUse `console-ban-convex.sh` + pre-commit hook PC1.
**Escape hatch:** `// comments-ok` on the same line.

## E2. Every error boundary reports errors

All `error.tsx` files under `src/app/` must call `reportError(error)` from `src/lib/error-reporting.ts`.
Error boundaries that only `console.error` are invisible in production.
`reportError` routes to PostHog in production, console in dev.

**Enforced by:** PostToolUse `error-boundary-reporting.sh`.

## E3. Core mutations use withMonitoring wrapper

Files in `convex/bookings/`, `convex/reservationsMutations.ts`, and `convex/availability.ts`
must wrap mutation handlers with `withMonitoring()` (once implemented in Phase 2).

**Enforced by:** PostToolUse `monitoring-wrapper-guard.sh` (Phase 2).
**Escape hatch:** `// monitor-exempt: <reason>`.

## E4. Public mutations require rate limiting

Every exported `mutation()` or `action()` must call `checkRateLimit`
or annotate `// ratelimit-exempt: <reason>`.

**Enforced by:** PostToolUse `rate-limit-guard.sh` (warn, not block).

## E5. Route groups require error boundaries

Every directory under `src/app/` containing `page.tsx` must have `error.tsx`.

**Enforced by:** PostToolUse `route-error-boundary.sh` + pre-commit hook PC2 (warn).

## E6. Snapshot reconciliation coverage

Any new table using `reservedUnits` or availability snapshot pattern
must be registered in the `reconcileSnapshots` cron.

**Enforced by:** Code review (manual — too complex for static analysis).

## E7. Deploy pipeline includes Convex rollback

`rollback.yml` must redeploy BOTH Vercel frontend AND Convex functions.

**Enforced by:** Code review on workflow changes.
