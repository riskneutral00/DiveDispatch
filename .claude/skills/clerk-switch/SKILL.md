---
name: clerk-switch
description: >
  Lightweight in-session user switch. Clears browser session, verifies Convex user,
  generates new token, navigates to dashboard. Skips full preflight (environment
  already healthy from initial clerk-signin).
allowed-tools: Bash, Read, Grep, mcp__playwright__browser_navigate, mcp__playwright__browser_close, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_wait_for, mcp__playwright__browser_snapshot
user-invocable: false
---

# clerk-switch — In-Session User Switch

Execute immediately. No explanation, no prompts. End state: a screenshot of the target user's dashboard.

## Input

Receives a user identifier (name, slug, or role alias) from the calling agent/skill.

---

## Procedure

### Step 1 — Resolve user

Read `.claude/data/seed-users.md`. Fuzzy-match the input against the Users table and aliases. Extract: `slug`, `roleSlug`.

If no match → return error with available users.

### Step 2 — Lightweight health check

```bash
curl -sf http://localhost:3000 > /dev/null 2>&1 && echo "OK" || echo "FAIL"
```

If FAIL → the dev server went down mid-session. Return error suggesting the caller invoke `Skill("dev-preflight")` before retrying.

### Step 3 — Verify Convex user exists

```bash
cd /Users/matthewlee/Desktop/RiskNeutral/DiveDispatch && npx convex run users:bySlug '{"slug":"<slug>"}'
```

If `null` → run `npm run seed:force` and retry once. If still null → return error.

### Step 4 — Get sign-in token

```bash
cd /Users/matthewlee/Desktop/RiskNeutral/DiveDispatch && npx tsx scripts/get-signin-token.ts <slug>
```

Capture the token from stdout.

### Step 5 — Clear session + authenticate

Close the Playwright browser (`browser_close`) to clear stale Clerk cookies. Then navigate to:

```
http://localhost:3000/sign-in#/?__clerk_ticket=<token>
```

Wait 3 seconds for Clerk to process the ticket.

### Step 6 — Navigate to dashboard

```
http://localhost:3000/{slug}/{roleSlug}/dashboard
```

Wait for the page to load. Take a screenshot.

**If redirects to `/sign-in`** → token didn't take. Get a new token, retry from Step 5 (max 2 retries).
**If redirects to `/sign-up`** → Convex user missing despite Step 3. Return error.

### Step 7 — Confirm

Return the screenshot and the user identity:
```
Switched to {Name} ({slug}) — {Role}
```
