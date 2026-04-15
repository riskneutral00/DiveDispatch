# Auth Model

> Canonical rules for authentication and authorization. Referenced by CLAUDE.md and skills.
> Last updated: 2026-04-12

## Architecture

DD uses a hybrid model: **Clerk Organizations (RBAC)** for org-level permissions + **relationship table (Convex)** for resource-level access.

### Key Distinctions

- **Clerk roles are permission tiers (~4: admin, manager, member, viewer).** They are NOT 1:1 mappings to DD's 12 stakeholder types. Do not create a Clerk role for each stakeholder type — Clerk caps at 10 custom roles per instance.
- **`userRoles` table tracks domain stakeholder type** (Instructor, Boat, Equipment, DiveCenter, etc.). It is NOT replaced by Clerk. It is augmented. `authorize()` needs both.
- **Clerk Organization = operational unit** (a dive center, a liveaboard operation), NOT a legal entity. One owner with Scuba Deep and M.V. Sirillo = admin in two separate Clerk Orgs.
- **Clerk JWT carries only the active organization's permissions.** Cross-org checks ("is this user admin of ANY operation?") require a Convex-side lookup.

### The Two Extremes

Every auth design must handle both:
1. **Everything in-house:** One dive center, all staff are org members. Pure Clerk RBAC. No relationship table needed.
2. **Fully independent:** Operator books freelance instructor, chartered boat, rented gear. None are org members. All access comes from per-booking entries in the relationship table.

## Rules

1. **All authorization goes through `authorize(ctx, actor, action, resource, orgId?)`.** No mutation assembles its own auth checks from `requireAuth` + `assertOwnership` + `checkHasRole`. One function, one place to audit, one place to test.
   - Enforced by: `/gate` blocks mutations without `authorize()` as first operation. `/review-backend-auth` flags direct use of `requireAuth`, `assertOwnership`, `checkHasRole`, `checkHasAnyOperatorRole`.
   - Violation history: 5 write mutations used nullable `getAuthUser` + manual throw instead of `requireAuth`. `themes.upsert` used `checkHasAnyOperatorRole` — any dive center, agent, or liveaboard could modify global themes. 8 profile table `byUserId` queries had zero auth check.

1a. **Use `authorizeWithRole` for the common "authorize + activeRole + readiness" composite.** When a mutation requires `authorize()` plus `requireActiveRole()` (and optionally `requireRoleReadiness()`), call `authorizeWithRole(ctx, action, activeRole, resource, { requireReadiness? })` instead of chaining the three calls. `authorize` alone is for resource ownership; `authorizeWithRole` adds role assertion.
   - Canonical: `convex/lib/auth.ts`
   - Used by: `createDraftShell`, `bookingTemplates.create`, other operator-scoped mutations.

1b. **Use `getRequiredUserBySlug(ctx, slug)` for required-user lookups.** Replaces the `.query('users').withIndex('by_slug').unique()` + NOT_FOUND throw pattern. Returns `Promise<Doc<'users'>>`. For batch lookups that tolerate missing users, keep the raw query + `.unique()` returning null.
   - Canonical: `convex/lib/auth.ts`

1c. **Use `getAllUserRoles(ctx, userId)` for per-user role collection.** Encapsulates the bounded `.withIndex('by_userId').collect()` pattern.
   - Canonical: `convex/lib/userRoleHelpers.ts`

1d. **Use `requireProfile(ctx, userId, tableName)` for required profile lookups** (vs `profileByUserId` which returns null).
   - Canonical: `convex/lib/profileHelpers.ts`

2. **Two credential models. No mixing.** Stakeholders authenticate via Clerk JWT. Customers authenticate via UUID portal token. No mutation accepts both. No mutation accepts neither (except explicitly public queries like theme metadata for store browsing).
   - Enforced by: `/review-backend-auth`
   - Existing implementation: `requireAuth` (Clerk path), `resolvePortalToken` (portal path)

3. **The relationship table handles per-booking resource access.** "Is instructor X assigned to booking Y?" is a relationship lookup, not an org membership check. Relationship tuples: `(subject_type, subject_id, relation, object_type, object_id)`.

4. **Clerk JWT template must include org claims.** The Clerk Dashboard JWT template for Convex must explicitly include `org_id`, `org_role`, `org_permissions`, and `org_slug`. Without these, `authorize()` cannot read org permissions from the JWT.

## Exceptions

- Portal mutations (`submitPortal`, `saveMedicalAnswers`) use `resolvePortalToken`, not `authorize()`. The portal has its own auth model — token IS the credential.
- Unauthenticated queries: theme `listStore` (store browsing metadata), health check. These are explicitly marked as public.
- **Bootstrap: `users.createUser`** uses raw `ctx.auth.getUserIdentity()` + manual `UNAUTHENTICATED` throw. Cannot route through `authorize()` because no `users` row exists yet at call time — this mutation is what creates the row from the Clerk identity. Idempotent: patches existing on token match. After successful create, all subsequent mutations for that user go through `authorize()`.
