---
description: Sign-in via UI page and slug lookup from seed data
paths:
  - "src/**/sign*"
  - "src/app/sign-in/**"
  - "e2e/**/sign*"
---

## Sign-in must use UI
Never use `browser_evaluate` to call `Clerk.signIn.create()` or `Clerk.setActive()`. Always navigate to `/sign-in`, fill the form, and follow the UI flow. Bypassing the UI leaves the app in a broken state where Clerk session exists but the app never processes the sign-in event.

## Resolve users by slug
When Matt says "log me into Hug Ocean", find the slug from seed data (e.g. `hug-ocean`) and use that. Don't search by display name — it always fails.
