# Production observability — minimal signals (Convex)

This document **defines** what to watch in production; wiring (Dashboards, Log Insights, or external APM) is environment-specific.

## 1. Rate limiting (`RATE_LIMITED`)

- **Source:** [convex/lib/rateLimiter.ts](../convex/lib/rateLimiter.ts) — portal and sensitive mutations throw `ConvexError` with code `RATE_LIMITED`.
- **Signal:** Count of `RATE_LIMITED` errors per **named limit** (e.g. `submitPortal`, `savePortalContact`) and per **key** prefix (hash or bucket user id if present).
- **Use:** Abuse detection, tuning `maxTokens` / `windowMs`, false positives after deploys.

## 2. Booking submit conflicts (`CONFLICT` / inventory)

- **Source:** [convex/bookings/create.ts](../convex/bookings/create.ts) — `submitToDraft` aborts with conflict when inventory snapshots cannot satisfy the request (see invariant comments).
- **Signal:** Rate of **conflict** outcomes vs successful submits; optional breakdown by `resourceType` or operator.
- **Use:** Capacity planning, double-booking bugs, stale UI, or snapshot drift (should be rare if invariants hold).

## 3. Clerk webhook (`/webhooks/clerk`)

- **Source:** [convex/http.ts](../convex/http.ts) — signature verification, idempotency, user sync / delete.
- **Signals:**
  - HTTP **4xx/5xx** rate on `/webhooks/clerk`.
  - **Signature failures** (log line or metric before returning 401).
  - **Duplicate `svixId`** handling (idempotent path vs new event).
- **Use:** Misconfigured `CLERK_WEBHOOK_SECRET`, clock skew, or Clerk outages.

## 4. User deletion cascade

- **Source:** [convex/users.ts](../convex/users.ts) — `cascadeUserDeletion` logs errors for non-isolatable failures; [convex/lib/alerts.ts](../convex/lib/alerts.ts) can email on batch failures.
- **Signal:** Count of `cascadeUserDeletion` failures; alert email sends for `user-deletion-cascade`.
- **Use:** Stuck cascades, schema drift (new table not cleaned up).

## 5. Cron health (secondary)

- **Source:** [convex/crons.ts](../convex/crons.ts) — `complete-bookings`, `purge-expired-drafts`, etc.
- **Signal:** Convex scheduler / function **failure** metrics per cron name (platform-dependent).
- **Use:** Silent breakage if cron handlers start throwing after a deploy.

## Implementation note

Convex dashboard logs already expose function-level errors and latency. Minimum viable workflow: **filter logs** by `ErrorCode`, `RATE_LIMITED`, and mutation names (`submitToDraft`, `cleanupDeletedUserData`, `deleteFromWebhook`) before investing in custom metrics pipelines.
