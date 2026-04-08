# DiveDispatch Incident Runbook

Quick-reference for diagnosing and resolving production issues.

---

## 1. Rolling Back a Bad Vercel Deploy

**Symptoms:** Broken UI, white screen, 500 errors after deploy.

**Steps:**

1. Go to [vercel.com](https://vercel.com) > your project > **Deployments**.
2. Find the last known-good deployment.
3. Click the three-dot menu > **Promote to Production**.
4. The rollback is instant — Vercel re-points the production URL to the previous build.

**Alternative (CLI):**

```bash
# List recent deployments
vercel ls

# Promote a specific deployment
vercel promote <deployment-url>
```

**Automated (GitHub Actions):**

Trigger the Rollback workflow from GitHub Actions with the commit SHA. This rolls back BOTH Convex functions and Vercel frontend, then runs a health check.

**Note:** Manual Vercel rollback only rolls back the Next.js frontend. If the issue is in Convex functions, see Section 2.

## 2. Rolling Back Convex Functions

**Symptoms:** Mutation errors, missing data, broken API behavior after `npx convex deploy`.

Convex does not have one-click rollback. To revert:

```bash
# Check out the previous working commit
git log --oneline -10
git checkout <good-commit-hash> -- convex/

# Re-deploy the reverted functions
npx convex deploy
```

**Important:** If the bad deploy included a schema migration, check the Convex dashboard **Data** tab to confirm data integrity before redeploying.

## 3. Checking Convex Logs

**Dashboard:**

1. Go to [dashboard.convex.dev](https://dashboard.convex.dev) > your project > **Logs**.
2. Filter by function name, log level, or time range.
3. Look for red error entries — click to expand the full stack trace.

**CLI:**

```bash
# Stream live logs
npx convex logs

# Filter to errors only
npx convex logs --success false
```

**What to look for:**

- `ConvexError` — application-level errors (validation failures, business rule violations).
- `Error` — unexpected exceptions (null references, missing env vars).
- Repeated function failures — may indicate a schema issue or missing environment variable.

## 4. Common Failure Modes

### 4.1 Auth Failures (401/403 or "Not authenticated")

**Cause:** Clerk-Convex auth misconfiguration.

**Diagnose:**

1. Check Convex dashboard > **Settings > Authentication** — is the Clerk issuer URL present and correct?
2. Check Vercel env vars — is `CLERK_ISSUER_URL` set and matching the Convex auth config?
3. Check Clerk dashboard — is the production domain added?

**Fix:**

- If issuer URL is wrong: update in both Convex auth settings and Vercel env vars, then redeploy.
- If domain is missing from Clerk: add it in Clerk dashboard > **Domains**.

### 4.2 Email Not Sending

**Cause:** Resend API key missing or domain not verified.

**Diagnose:**

1. Check Convex dashboard > **Settings > Environment Variables** — is `RESEND_API_KEY` set?
2. Check Convex logs for errors in email-sending actions.
3. Check Resend dashboard — is the sending domain verified?

**Fix:**

- Set or update `RESEND_API_KEY` in Convex dashboard (not Vercel).
- Verify sending domain in Resend dashboard > **Domains**.
- Ensure `SITE_URL` in Convex env vars matches your production URL (used for portal links in emails).

### 4.3 "Convex deployment not found" or Blank Page

**Cause:** `CONVEX_DEPLOYMENT` or `NEXT_PUBLIC_CONVEX_URL` is missing or wrong.

**Diagnose:**

1. Check Vercel env vars for both values.
2. Confirm the Convex project exists in the dashboard.

**Fix:**

- Copy the correct values from Convex dashboard > **Settings > URL & Deploy Key**.
- Update in Vercel > **Settings > Environment Variables** and redeploy.

### 4.4 Build Failures on Vercel

**Cause:** TypeScript errors, missing dependencies, or env vars not available at build time.

**Diagnose:**

1. Check Vercel deployment logs — the build output shows the exact error.
2. Common culprits: new `NEXT_PUBLIC_*` env var not added to Vercel, Convex codegen mismatch.

**Fix:**

- Add missing env vars in Vercel and retry the build.
- If Convex types are stale: run `npx convex dev --once` locally to regenerate, commit, and push.
- If a dependency is missing: check `package.json` and run `npm install` locally to verify.

### 4.5 Booking Data Inconsistency

**Cause:** Partial mutation failure or TTL expiry edge case.

**Diagnose:**

1. Check Convex logs for the mutation that wrote the booking.
2. Look at the booking record in Convex dashboard > **Data** > `bookings` table.
3. Check `reservations` table for orphaned or duplicate holds.

**Fix:**

- DiveDispatch mutations are all-or-nothing — if a mutation errored, no partial data was written.
- If a booking shows `Draft` with `expiresAt` in the past, the TTL lazy-expiry will cancel it on next read.
- For truly inconsistent data, use the Convex dashboard to inspect and manually correct records, then investigate the root cause in logs.

## 5. Observability Stack

Client-side observability uses PostHog (error tracking, session replay, feature flags, analytics). Server-side uses Convex structured logging + email alerts. Vercel provides infrastructure-level logs.

### 5.1 Client-Side Errors (PostHog + Vercel)

- **Error boundaries** (`src/app/error.tsx` and route-level variants) catch unhandled React errors and report them via `reportError()` from `src/lib/error-reporting.ts`, which routes to PostHog.
- **PostHog dashboard** shows error grouping, session replay for error context, and error trends. Free tier: 100K errors/month.
- **Health check** endpoint at `/health` on the Convex HTTP router — returns 200/503. Wire UptimeRobot or similar to ping every 5 minutes.
- **Vercel Observability dashboard** shows function invocation counts, error rates, and latency. Go to Vercel > your project > **Observability**.
- **Vercel Runtime Logs** capture `console.*` output from Next.js server components and API routes. Go to Vercel > **Logs** and filter by level or time range.

### 5.2 Server-Side Errors (Convex)

- **Structured logger** (`convex/lib/logger.ts`) emits JSON to stdout with `level`, `message`, `timestamp`, and arbitrary context fields. Convex captures all stdout.
- **ConvexError with error codes** (`convex/lib/errorCodes.ts`) — all mutation error paths throw `ConvexError({ code })` using canonical codes. These appear as structured errors in the Convex dashboard logs.
- **Convex dashboard** retains approximately the last 1000 function executions with full error details. Go to [dashboard.convex.dev](https://dashboard.convex.dev) > **Logs**.
- **CLI log streaming:** `npx convex logs` for live tail, `npx convex logs --success false` for errors only.

### 5.3 Cron Failure Alerts

- `convex/lib/alerts.ts` logs cron failures to the `cronRunLog` table and sends alert emails via Resend to `alerts@divedispatch.dev`.
- Check `cronRunLog` table in the Convex dashboard **Data** tab for historical cron run status.

### 5.4 PostHog Setup

PostHog is configured via `NEXT_PUBLIC_POSTHOG_KEY` env var. When unset, `reportError()` gracefully no-ops and the PostHogProvider renders children without wrapping.

To activate: create a free account at posthog.com, create a project, copy the API key, and set `NEXT_PUBLIC_POSTHOG_KEY` in Vercel env vars.

PostHog free tier includes: 1M analytics events/month, 100K error logs/month, 5K session replays/month, 1M feature flag requests/month.

## 6. Staging Environment

The staging environment deploys from the `staging` branch via `.github/workflows/deploy-staging.yml`.

**One-time setup required:**

1. **Create a Convex staging project**: `npx convex dev --configure` in a separate terminal, select "Create a new project", name it `dive-dispatch-staging`
2. **Add Convex staging deploy key**: Copy the deploy key from the staging project's Convex dashboard. Add it as `CONVEX_STAGING_DEPLOY_KEY` in GitHub repo secrets.
3. **Create the staging branch**: `git checkout -b staging && git push -u origin staging`
4. **Set Vercel preview URL**: In GitHub repo settings > Variables, set `PLAYWRIGHT_BASE_URL` to the Vercel preview URL for the staging branch. This activates E2E smoke tests in CI.
5. **Seed staging data**: Once deployed, run `npx convex run seed:seedAll` against the staging Convex project.

**Usage:**

- Push to `staging` to deploy. The workflow runs the full quality gate (lint, typecheck, test, i18n) then deploys to Convex staging + Vercel preview.
- Merge `staging` → `main` only after verifying staging works.
- Use staging as the E2E target in CI.

## 7. Disaster Recovery

### 6.1 Convex Outage

**Detection:** `/health` endpoint returns 503; Convex dashboard shows degraded status.

**Impact:** All mutations and queries fail. Dashboard is unusable. Portal continues to load static pages but form submissions fail.

**Response:**
1. Check [Convex status page](https://status.convex.dev).
2. If confirmed outage, no action needed — Convex handles recovery. Client reconnects automatically via Convex's reactive protocol.
3. Monitor `/health` endpoint for recovery.
4. Customer communication: portal shows a generic error state via error boundaries.

### 6.2 Clerk Outage

**Detection:** Sign-in fails; dashboard returns 401; Clerk status page shows incident.

**Impact:** No new sign-ins or sign-ups. Existing sessions may continue working (Clerk JWTs have TTL). Portal is unaffected (tokenized, no Clerk auth).

**Response:**
1. Check [Clerk status page](https://status.clerk.com).
2. No action needed — Clerk handles recovery.
3. Existing sessions with valid JWTs continue working.

### 6.3 Data Corruption Investigation

**Symptoms:** Booking shows wrong status, reservations don't match snapshots, orphaned records.

**Response:**
1. Check `bookingAuditLog` table for the affected booking — this shows every state transition with actor, action, and timestamp.
2. Check `cronRunLog` table for recent cron failures.
3. Check Convex logs for the mutation that wrote the bad data.
4. The all-or-nothing invariant means partial writes shouldn't exist — if data is inconsistent, it's likely a race condition between mutations.

**Data export for forensics:**
```bash
npx convex export --path ./backup-$(date +%Y%m%d)
```

### 6.4 Service URLs

| Service | Dashboard | Status Page |
|---------|-----------|-------------|
| Convex | [dashboard.convex.dev](https://dashboard.convex.dev) | [status.convex.dev](https://status.convex.dev) |
| Clerk | [dashboard.clerk.com](https://dashboard.clerk.com) | [status.clerk.com](https://status.clerk.com) |
| Vercel | [vercel.com](https://vercel.com) | [vercel-status.com](https://www.vercel-status.com) |
| PostHog | [us.posthog.com](https://us.posthog.com) | [status.posthog.com](https://status.posthog.com) |
| Resend | [resend.com](https://resend.com) | — |

## 7. Escalation Contacts

| Service | Where to get help |
|---|---|
| Vercel | [vercel.com/help](https://vercel.com/help) or status page: [vercel-status.com](https://www.vercel-status.com) |
| Convex | [dashboard support](https://dashboard.convex.dev) or [Discord](https://discord.gg/convex) |
| Clerk | [clerk.com/support](https://clerk.com/support) or status page: [status.clerk.com](https://status.clerk.com) |
| Resend | [resend.com/docs](https://resend.com/docs) |

## 7. Quick Reference

```bash
# Stream Convex logs
npx convex logs

# Deploy Convex functions
npx convex deploy

# Trigger Vercel redeploy
vercel --prod

# List Vercel deployments
vercel ls

# Check Convex function status
npx convex dashboard
```
