---
description: Testing methodology, ownership, and quality standards
---

## Claude owns all tests
Matt doesn't write tests. Default to vitest + `convex-test` for integration. Don't write Playwright E2E unless explicitly requested.

## Peer TDD
Testing is dialogue. Interview Matt about behaviors one at a time, get confirmation, then write the test. Never batch-write tests solo.

## No CRUD tests for Convex
Convex validates argument types via `v.object()` at framework level. Only test business logic that can fail silently — credential matching, ratio enforcement, inventory guards. Not thin `ctx.db.insert` wrappers.

## QA must be adversarial
"Review tests" triggers confirmation bias. Use `/qa` skill for adversarial analysis. Evaluate by asking "what breaks in production that no test would catch?" — not by counting tests or checking pass/fail.

## Verify before ticketing
Before claiming a feature is "missing," grep hooks, components, queries, and tests. Creating tickets for existing features wastes time and erodes trust.
