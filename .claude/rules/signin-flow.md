---
description: Browser auth must go through the real UI — never browser_evaluate(Clerk.signIn.create)
paths:
  - "e2e/**"
  - ".claude/skills/clerk-signin/**"
  - ".claude/skills/clerk-switch/**"
---

## Sign-in must use UI
Never use `browser_evaluate` to call `Clerk.signIn.create()` or `Clerk.setActive()`. Always navigate to `/sign-in`, fill the form, and follow the UI flow. Bypassing the UI leaves the app in a broken state where Clerk session exists but the app never processes the sign-in event.

Slug-based user resolution lives in `/clerk-signin` and `/clerk-switch` — both read `.claude/data/seed-users.md`. Use those skills; don't reimplement the lookup here.
