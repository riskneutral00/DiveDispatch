---
description: Seed data safety — use npm run seed:force, never raw seed commands
paths:
  - "convex/seed*.ts"
  - "scripts/seed*"
---

Never run `seed:seedAll` or `seed:wipeAll` directly. Always use `npm run seed:force` which chains wipe → seed → clerk linking → verify.

Raw seed creates Convex users with `seed|{slug}` tokenIdentifiers that don't match Clerk accounts, breaking auth for all seeded users. PreToolUse hooks block both Bash and MCP seed calls.
