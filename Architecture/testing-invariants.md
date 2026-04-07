# Testing Invariants

> Canonical rules for test authorship in DiveDispatch. Referenced by CLAUDE.md and skills.
> Last updated: 2026-04-06

## Rules

1. **Tests use real Convex contexts, not mocks.** Use `makeT()` from `convex-test` to create isolated test contexts. Do not mock Convex queries or mutations. Mocked tests prove the mock works, not the code.
   - Enforced by: `/review-tests` flags `vi.mock` or `jest.mock` on Convex functions
   - Context: Uber explicitly acknowledged their unit tests "were often so dependent on mocks that it was difficult to understand how much protection they actually offered."

2. **New test files use shared fixtures for domain setup.** Do not inline `ctx.db.insert` calls for common entities (users, bookings, reservations). Import from `tests/fixtures/` (`seedUsers.ts`, `seedBookings.ts`, `seedInventory.ts`, `seedProfiles.ts`, `seedStakeholders.ts`). When the schema changes, one fixture breaks once — not 268 files breaking individually.
   - Enforced by: `/review-tests` flags inline seeding of common entities in new test files
   - Violation history: 0% fixture adoption across 268 test files. Every file built its own "valid booking" from scratch.

3. **Time-dependent tests use `vi.setSystemTime`.** No hardcoded dates like `new Date('2025-06-15')` without a `vi.setSystemTime` guard. Hardcoded past dates will silently drift and tests will pass for the wrong reasons.
   - Enforced by: `/review-tests` flags `new Date('20` patterns without nearby `vi.setSystemTime`
   - Violation history: `stateMachineTime.test.ts` used hardcoded past dates without time guards — a time bomb.

4. **Components with `useMutation` must have at least one integration test.** These are the components that change server state. Test them against real Convex queries via `convex-test`, not against mocked data stores.
   - Enforced by: `/review-tests` flags new `useMutation` components without test coverage
   - Current gap: 16 HIGH-risk components with `useMutation` have zero tests

5. **Test the invariant, not the code.** Test names should be domain propositions ("exclusive inventory cannot be double-booked"), not implementation descriptions ("submitToDraft throws when snapshot is zero"). This is already DD's philosophy — preserve it.
   - See: `tests/hardening/inventory-invariants.test.ts` (16 tests naming the three non-negotiable invariants as propositions)

6. **E2E tests create their own state.** Never assert against seed data. A test that reads seed data is a tautology — it proves the seed script ran, not that the application works.

7. **E2E assertions use exact text, never regex alternatives.** `page.getByText('Upcoming')` — not `/Upcoming|Draft|Completed/i`. Regex alternatives match any state and mask broken transitions.

## Exceptions

- Pure utility functions (`convex/lib/`, `convex/shared/`) may use simple unit tests without `makeT()` — they have no Convex dependencies.
- Test helpers in `tests/helpers/` may use inline seeding for test infrastructure setup.
