# Error Invariants

> Canonical rules for error handling in Convex mutations. Referenced by CLAUDE.md and skills.
> Last updated: 2026-04-06

## Rules

1. **All `ConvexError` throws use shape `{ code: ErrorCode, reason?: string }`.** The field is `reason`, not `message`. No ad-hoc string codes — use the `ErrorCode` enum in `convex/lib/errorCodes.ts`.
   - Enforced by: `/gate` flags `ConvexError` with `message` field or string literal codes
   - Violation history: Some mutations threw `{ code, message }`, others `{ code, reason }`. The frontend defensively chained `data.reason ?? data.message ?? data.code` as a workaround.

2. **Every `ErrorCode` has an i18n mapping in `parseConvexErrorI18n`.** If you add a new error code, you add its user-facing message in the same PR. No code may show "Something went wrong" to the user when a specific, actionable message exists.
   - Enforced by: `/gate` blocks new `ErrorCode` values without corresponding i18n entry
   - Violation history: Only 5 of 20+ error codes were mapped: `TOKEN_EXPIRED`, `BOOKING_CLOSED`, `FORMS_INCOMPLETE`, `DUPLICATE_ROLE`, `LAST_ROLE`. Users hitting `CONFLICT`, `BLOCKED_DATE`, `RATE_LIMITED`, `INVALID_TRANSITION` all saw generic "Something went wrong."

3. **Deprecated error codes are removed, not kept.** If a code is replaced by another (e.g., `COVERAGE_INCOMPLETE` → `RESOURCES_INCOMPLETE`), delete the old one. Do not leave dead enum values.

4. **System errors and business errors are distinct.** (Long-term direction — not yet enforced.)
   - System errors (`UNAUTHENTICATED`, invariant violations, internal failures): throw `ConvexError`. These are exceptional.
   - Business errors (`CONFLICT`, `BLOCKED_DATE`, `FORMS_INCOMPLETE`): should eventually be structured return values, not throws. A user doing something invalid is an expected outcome, not an exception.

## Exceptions

- None. These rules apply to all Convex mutations.
