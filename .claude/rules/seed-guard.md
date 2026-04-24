---
description: Seed data safety — use npm run seed:force, never raw seed commands
paths:
  - "convex/seed*.ts"
  - "scripts/seed*"
---

Never run `seed:seedAll` or `seed:wipeAll` directly. Always use `npm run seed:force` which chains wipe → seed → clerk linking → verify.

Raw seed creates Convex users with `seed|{slug}` tokenIdentifiers that don't match Clerk accounts, breaking auth for all seeded users. PreToolUse hooks block both Bash and MCP seed calls.

## Two paths: full reset vs. daily role restoration

- **Full reset** (nuclear): `npm run seed:force`. Wipes and replays everything from `convex/seedData.ts` + `convex/seedInstructorData.ts`.
- **Daily role restoration** (Phase 3 workflow, 2026-04-22 onward): drive UI signup in Playwright, then run `tsx scripts/capture-role-to-seed.ts --slug <user-slug>` to persist the hand-created user back into seed data. This is the current default loop — don't reach for `seed:force` for per-user work.
