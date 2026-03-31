---
name: clerk-signin
description: >
  Full Clerk sign-in procedure. Preflight, fuzzy user match,
  Convex user verification, token generation, session clearing, dashboard navigation.
  Replaces /clerk-dev.
allowed-tools: Bash, Read, Grep, Glob, Skill, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_close, mcp__playwright__browser_type, mcp__playwright__browser_wait_for, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_fill_form
user-invocable: true
---

# /clerk-signin — Full Sign-In Procedure

Execute immediately when invoked. No explanation, no prompts. End state: a screenshot of the target user's dashboard.

## Argument: user search

`/clerk-signin --<search>` fuzzy-matches the search term against `.claude/data/seed-users.md` (name, slug, email, or alias). Use the **first match**. If no match → stop and list available users.

Examples: `/clerk-signin --hug` → Hug Ocean, `/clerk-signin --ryan` → Ryan Clarke, `/clerk-signin --sirolo` → Sirolo

If invoked with no argument (`/clerk-signin`), default to **Hug Ocean** (`n7rq5j`).

---

## What hooks already handle (don't duplicate)

- **Dev server** — auto-starts in tmux if port 3000 is not listening (fires on every `browser_navigate`)
- **Slug resolution** — "log me into X" messages auto-run `seed:clerk --force` + inject email/slug/password via `login-slug-resolver.sh`
- **`browser_evaluate` sign-in blocked** — Clerk APIs via evaluate are permanently blocked; never attempt this

---

## Sign-In Procedure

### Step 1 — Pre-flight

Invoke `Skill("dev-preflight")`. If it returns FAIL → stop and report. Do not proceed with a broken environment.

---

### Step 2 — Resolve user

Read `.claude/data/seed-users.md`. Fuzzy-match the argument against the Users table and Fuzzy Matching aliases. Extract: `slug`, `roleSlug`, `email`.

---

### Step 3 — Playwright MCP availability check

Use `ToolSearch` to check for `mcp__playwright__browser_navigate`.

If Playwright MCP tools are **not available** → **stop immediately**:

> "⚠️ Playwright MCP is not available this session. Please restart Claude Code and try again."

Do not use any headless fallback script.

---

### Step 4 — Verify Convex user exists

```bash
cd /Users/matthewlee/Desktop/RiskNeutral/DiveDispatch && npx convex run users:bySlug '{"slug":"<slug>"}'
```

If the result is `null` → Convex doesn't have the user record. Run `npm run seed:force` and retry from Step 1. Do NOT proceed — the `/dashboard` trampoline will hang forever.

---

### Step 5 — Get sign-in token

```bash
npx tsx scripts/get-signin-token.ts <slug>
```

> Use the `npx tsx` form directly — avoids npm script resolution overhead.

Capture the token from stdout (long alphanumeric string).

---

### Step 6 — Clear previous session + set new one

Close the Playwright browser (`browser_close`) to clear any stale Clerk cookies. Then navigate to the ticket URL in a fresh browser:

```
http://localhost:3000/sign-in#/?__clerk_ticket=<token>
```

Wait 3 seconds for Clerk to process the ticket and set the session cookie.

---

### Step 7 — Navigate to dashboard

Using the **roleSlug** from seed-users.md (not from Convex), navigate to:

```
http://localhost:3000/{slug}/{roleSlug}/dashboard
```

Wait for the page to load. Take a screenshot.

**If it redirects to `/sign-in`** → Clerk session wasn't set. Get a new token and retry from Step 5.
**If it redirects to `/sign-up`** → Convex user missing. Run `npm run seed:force` and retry from Step 1.

---

## Seed Commands

| Command | What it does |
|---------|-------------|
| `npm run seed:force` | All-in-one: wipe Convex + reseed + sync Clerk + verify |
| `npm run seed:clerk -- --force` | Delete all `@divedispatch.dev` Clerk accounts + recreate seed users |
| `npm run seed:clerk` | Sync Clerk users only (create/skip, no deletion) |
| `npm run seed:verify` | Verify seed data integrity without modifying anything |

---

## Troubleshooting

Most issues are caught by `dev-preflight`. These cover edge cases the script can't handle:

| Symptom | Fix |
|---------|-----|
| Pre-flight passes but sign-in still fails | `npm run seed:force` then retry from Step 1 |
| Dev switcher not visible | Set `DEV_MODE=true` in Convex dashboard env vars |
| `/dev/signin-token` returns 403 | Set `ENVIRONMENT=development` in Convex dashboard env vars |
| Pre-flight `[FAIL] Dev server unhealthy` | Check tmux logs: `tmux attach -t dev`. Fix build errors, then re-run preflight |
| Pre-flight `[FAIL] Convex deployment` | Check Convex dashboard for deployment errors |
