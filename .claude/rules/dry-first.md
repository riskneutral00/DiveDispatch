---
description: DRY-first discipline — check for existing implementations before creating new ones
---

## Check before you create
Before defining a new constant, type, schema, or utility function, grep `src/lib/constants/`, `src/lib/utils/`, `src/lib/profile-form/`, and `convex/lib/` for an existing implementation. If one exists, import it. Do not create a local copy.

## Canonical sources
- **Role config:** `src/lib/constants/roles.ts` (`ROLE_BY_KEY`, `ROLE_BY_CLERK_ROLE`, `tableName`, `profileTabs`)
- **Boat types:** `src/lib/constants/boat-types.ts`
- **Gas mixes:** `src/lib/constants/gas-mixes.ts`
- **Profile section props:** `src/lib/profile-form/types.ts` (`BaseProfileSectionProps`)
- **Contact field helpers:** `src/lib/profile-form/location.ts` (`contactFieldsFromProfile`, `locationToPayload`, `defaultFromMe`)
- **Number parsing:** `src/lib/utils/numbers.ts` (`parseNumber`)
- **Role-to-table map:** `convex/lib/profileHelpers.ts` (`ROLE_TABLE_MAP`, `profileByUserId`)
- **Auth gateway:** `convex/lib/auth.ts` (`authorize()` — the single entry point per `Architecture/auth-model.md` Rule 1. Internal helpers `requireAuth`, `assertOwnership`, `requireOwnerOrResourceAccess` are consumed by `authorize()` — do NOT call them directly in mutations.)
- **Booking resource context:** `convex/bookings.ts` (`buildResourceContext`)

## Three copies = extract
If the same logic exists in 3+ places, extract it to a shared file before adding a 4th. If it exists in 2 places, flag it in the PR description or `/gate` output for the next `/design propagate` run — do not add inline comments (per no-comments rule).

## No local type aliases for shared shapes
Do not define a local `type FooProps = { profile: ..., me: ..., create: ..., update: ... }` when `BaseProfileSectionProps` (or an extension of it) fits. Import and extend instead.
