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

**Note:** This only rolls back the Next.js frontend. If the issue is in Convex functions, see Section 2.

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

## 5. Escalation Contacts

| Service | Where to get help |
|---|---|
| Vercel | [vercel.com/help](https://vercel.com/help) or status page: [vercel-status.com](https://www.vercel-status.com) |
| Convex | [dashboard support](https://dashboard.convex.dev) or [Discord](https://discord.gg/convex) |
| Clerk | [clerk.com/support](https://clerk.com/support) or status page: [status.clerk.com](https://status.clerk.com) |
| Resend | [resend.com/docs](https://resend.com/docs) |

## 6. Quick Reference

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
