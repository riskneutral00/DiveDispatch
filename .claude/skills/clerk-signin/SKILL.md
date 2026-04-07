---
name: clerk-signin
description: >
  Full environment bootstrap + browser sign-in. Finds open port, starts dev server,
  seeds Convex + Clerk, logs in via Playwright UI (real user flow, no tokens),
  navigates to dashboard, takes screenshot. Self-healing on errors.
allowed-tools: Bash, Read, Grep, Glob, Skill, Agent, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_close, mcp__playwright__browser_type, mcp__playwright__browser_wait_for, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_fill_form
user-invocable: true
---

# /clerk-signin — Environment Bootstrap + Browser Sign-In

Execute immediately. No explanation, no prompts. End state: a screenshot of the target user's dashboard in a real browser.

**ABSOLUTE RULES:**
- Playwright runs in HEADED mode only. Never headless. Never `browser_evaluate` for auth.
- Sign in through the UI exactly as a real user would: type email, type password, click submit, enter OTP if prompted.
- No tokens. No `dev:token`. No `__clerk_ticket`. The real sign-in form, every time.

## Argument

`/clerk-signin --<search>` fuzzy-matches against `.claude/data/seed-users.md`.

Examples: `/clerk-signin --hug` → Hug Ocean, `/clerk-signin --ryan` → Ryan Clarke, `/clerk-signin --amanda` → Amanda

No argument → default to Hug Ocean.

Also triggered by natural language: "show me Hug Ocean's dashboard", "log me into Ryan", "open Amanda's dashboard". The `login-slug-resolver.sh` hook resolves the name and injects credentials.

---

## Phase 1: Resolve User

Read `.claude/data/seed-users.md`. Match the argument against Name, Slug, Email, or aliases. Extract:

| Field | Example (Hug Ocean) |
|-------|-------------------|
| `name` | Hug Ocean |
| `slug` | n7rq5j |
| `roleSlug` | dive-center |
| `email` | hug-ocean+clerk_test@divedispatch.dev |
| `password` | divedispatch123 |
| `otp` | 424242 |

If no match → list available users and stop.

---

## Phase 2: Dev Server

Check ports 3000, 3001, 3002, 3003 in order:

```bash
for PORT in 3000 3001 3002 3003; do
  lsof -ti :$PORT >/dev/null 2>&1 || { echo "$PORT is free"; break; }
done
```

**If a port has this user already logged in** (check `.claude/data/active-sessions.json` if it exists) → reuse that port. Skip to Phase 6.

**If a free port is found** → start the dev server on that port:

```bash
cd /Users/matthewlee/Desktop/RiskNeutral/DiveDispatch
tmux new-session -d -s "dev-$PORT" "PORT=$PORT npm run dev -- --port $PORT 2>&1"
```

Wait until the port is listening (poll with `lsof -ti :$PORT`, max 30 seconds).

**If all 4 ports are occupied** → stop and report:
> "All ports 3000-3003 are in use. Kill a dev server first: `tmux kill-session -t dev-<port>`"

---

## Phase 3: Convex

Verify Convex is running and has seed data:

```bash
cd /Users/matthewlee/Desktop/RiskNeutral/DiveDispatch
npx convex run users:bySlug '{"slug":"<slug>"}' 2>/dev/null
```

**If result is `null` or command fails** → seed everything:

```bash
npm run seed:force
```

Then re-check. If still null → stop and report the error.

---

## Phase 4: Clerk Users

Sync Clerk test users:

```bash
cd /Users/matthewlee/Desktop/RiskNeutral/DiveDispatch
npm run seed:clerk -- --force
```

This deletes all `@divedispatch.dev` accounts and recreates them fresh. Ensures credentials match.

---

## Phase 5: Browser Sign-In

Close any existing Playwright browser (`browser_close`) to clear stale sessions.

Navigate to the sign-in page:

```
http://localhost:<PORT>/sign-in
```

Wait for the Clerk sign-in form to render (look for the email input field).

**Sign in through the UI:**

1. Find the email input field. Type `<email>`.
2. Click "Continue" or the submit button.
3. Find the password input field. Type `<password>`.
4. Click "Continue" or the submit button.
5. If an OTP/code input appears → type `424242`.
6. Wait for redirect away from `/sign-in`.

**If sign-in fails** (error message appears, stays on sign-in page):
- Take a screenshot for diagnosis.
- Re-run `npm run seed:clerk -- --force` (credentials may be stale).
- Retry from step 1 of this phase. Max 2 retries.

**If the page shows a build error or white screen:**
- Check the dev server tmux session: `tmux capture-pane -t "dev-<PORT>" -p | tail -20`
- Fix the build error.
- Retry.

---

## Phase 6: Navigate to Dashboard

After successful sign-in, navigate to:

```
http://localhost:<PORT>/<slug>/<roleSlug>/dashboard
```

Wait for the dashboard to load (look for page content, not a loading spinner).

**If redirected to `/sign-in`** → session wasn't set. Retry Phase 5.
**If redirected to `/sign-up`** → Convex user missing. Run `npm run seed:force` and retry from Phase 3.
**If the page shows an error** → take a screenshot, read the error, fix the cause, retry.

---

## Phase 7: Confirm

Take a screenshot of the dashboard. This is the proof it worked.

Update `.claude/data/active-sessions.json`:

```json
{
  "<PORT>": { "user": "<slug>", "name": "<name>", "started": "<ISO timestamp>" }
}
```

Report:
> "Signed into <name> on port <PORT>. Dashboard: http://localhost:<PORT>/<slug>/<roleSlug>/dashboard"

---

## Self-Healing Summary

| Problem | Fix | Max Retries |
|---------|-----|-------------|
| Port occupied | Try next port (3000→3003) | 4 |
| All ports full | Tell user to kill a port | 0 |
| Dev server won't start | Read tmux logs, fix build error | 2 |
| Convex user missing | `npm run seed:force` | 1 |
| Clerk sign-in rejected | `npm run seed:clerk -- --force` + retry | 2 |
| Page error/white screen | Read error, fix, retry | 2 |
| Redirects to /sign-in after login | Retry Phase 5 | 2 |
| Redirects to /sign-up | `npm run seed:force` | 1 |
| Playwright not available | Stop, tell user to restart Claude Code | 0 |

---

## Seed Commands Reference

| Command | What it does |
|---------|-------------|
| `npm run seed:force` | Wipe Convex + reseed all data + sync Clerk users |
| `npm run seed:clerk -- --force` | Delete all @divedispatch.dev Clerk accounts + recreate |
| `npm run seed:clerk` | Sync Clerk users (create/skip, no deletion) |
| `npm run seed:verify` | Verify seed data integrity without modifying |
