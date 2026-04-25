---
description: DRY-first discipline — check for existing implementations before creating new ones
---

## Check before you create
Before defining a new constant, type, schema, or utility function, grep `src/lib/constants/`, `src/lib/utils/`, `src/lib/schemas/`, `src/lib/profile-form/`, and `convex/lib/` for an existing implementation. If one exists, import it. Do not create a local copy.

## Canonical sources

### Frontend — constants + utils
- **Role config:** `src/lib/constants/roles.ts` (`ROLE_BY_KEY`, `ROLE_BY_CLERK_ROLE`, `tableName`, `profileTabs`, `roleClass` per-entry)
- **Boat types:** `src/lib/constants/boat-types.ts`
- **Gas mixes:** `src/lib/constants/gas-mixes.ts`
- **i18n constants:** `src/lib/constants/i18n.ts` (`COUNTRY_CODES`, `LANGUAGE_CODES`, `LOCALE_CODES`, `E164_REGEX`, `isValidCountryCode`, `isValidPhoneE164`, `isValidLocale`, `isValidLanguageCode`, `normalizePhone`)
- **Supported locales:** `src/lib/constants/locales.ts` (`SUPPORTED_LOCALES`, `SupportedLocale`)
- **Button sizes:** `src/lib/constants/button-sizes.ts` (`BUTTON_SIZE_MAP`, `ICON_BUTTON_SIZE`, `MENU_BUTTON_SIZE_MAP`, `TOUCH_TARGET_CLASS`)
- **Number parsing:** `src/lib/utils/numbers.ts` (`parseNumber`)
- **Date formatters:** `src/lib/utils/date.ts` (`formatDateRange`, `formatDateRangeLocalized`, `formatDateRangeCompact`, `formatDateShort`, `toISODateString`, `addDays`, `diffDays`)
- **Role default:** `src/lib/utils/role.ts` (`deriveDefaultRole` — picks a default role from a user's assigned roles; used by signup post-auth redirect and dashboard role selection)

### Frontend — Zod schemas
- **Address shape:** `src/lib/schemas/location.ts` (`addressLocationSchema`, `AddressLocationValue`)
- **i18n validators:** `src/lib/schemas/i18n.ts` (`e164Schema` — phone, `localeSchema` — 6-literal appLanguage)
- **Profile shared:** `src/lib/schemas/profile-shared.ts` (re-exports `addressLocationSchema`)

### Frontend — profile form helpers
- **Profile section props:** `src/lib/profile-form/types.ts` (`BaseProfileSectionProps`)
- **Contact field helpers:** `src/lib/profile-form/location.ts` (`contactFieldsFromProfile`, `locationToPayload`, `defaultFromMe`)

### Frontend — UI primitives
- **Save button:** `src/components/ui/save-button.tsx` (`SaveButton` — supports form submit and standalone onClick)
- **Menu button:** `src/components/ui/menu-button.tsx` (`MenuButton` — navigation items, tabs, dropdown entries)

### Convex — profile + role resolution
- **Role-to-table map:** `convex/lib/profileHelpers.ts` (`ROLE_TABLE_MAP`, `profileMine`, `profileBySlug`, `profileByUser`, `profileUpdate`, `profileCreate`, `getProfileName`)
- **Per-user role collection:** `convex/lib/userRoleHelpers.ts` (`getAllUserRoles` — replaces inline `.withIndex('by_userId').collect()` on `userRoles`; `insertUserRole` — every userRoles insert site uses this. `organizationId` is a **required** parameter; the caller must resolve org first.)
- **User org assignment:** `convex/lib/userOrg.ts` (`setUserOrganization(ctx, userId, orgId)` — single writer for `user.organizationId`. Patches the user AND syncs every `userRoles.organizationId` in the same mutation. Never call `ctx.db.patch(userId, { organizationId })` directly — the denorm on `userRoles` will drift. Callers: `ensurePersonalOrg`, `createUser` activeOrg paths, `organizations.upsertFromWebhook` creator patch, `seed` paths.)

### Convex — auth gateway
- **Primary entry points:** `convex/lib/auth.ts` — `authorize()` is the single entry point per `Architecture/auth-model.md` Rule 1. `authorizeWithRole()` is the composite when a mutation needs `authorize` + `requireActiveRole` + optional readiness. `getRequiredUserBySlug()` replaces slug-lookup + NOT_FOUND throw. `assertOrgOwnership()` asserts a resource's `organizationId` matches the active org. Internal helpers `requireAuth`, `assertOwnership`, `requireOwnerOrResourceAccess` are consumed by `authorize()` — do NOT call them directly in mutations.
- **Active-org resolution:** `convex/lib/activeOrg.ts` (`getActiveOrg` — two-path resolution (JWT claim or personal-org fallback) per Rule 11, `requireOrgAdmin` — composite active-org + admin-role assertion, `tryGetActiveOrg` — non-throwing variant, `isPersonalOrg` — `clerkOrgId === undefined` predicate guarding the fallback branch, `readOrgClaims` — extract `{orgId, orgRole, orgSlug}` from the JWT identity). See `Architecture/auth-model.md` Rules 8, 9, 11, 13 and entities `[[organization]]` + `[[clerk-convex-org-sync]]`.
- **tokenIdentifier rebind:** `convex/lib/tokenIdentifier.ts` (`parseTokenIdentifier`, `isAllowedRebind`, `isLikelyClerkIssuer`) — `upsertFromWebhook` email-rebind path gates on issuer lineage per Rule 13.
- **Org cascade on delete:** `convex/lib/orgCascade.ts` (`cascadeOrgDelete` — nulls `users.organizationId` + `userRoles.organizationId`, deletes child profile rows and grandchildren). Called by `organizations.deleteFromWebhook` before the org row is removed.

### Convex — validation (mutation boundary, defense-in-depth)
- **i18n validators:** `convex/lib/i18nValidators.ts` (`assertCountryCode`, `assertPhoneE164`, `assertSupportedLocale`, `assertLanguageCodes`, `normalizeAppLanguage`, `normalizeAppLanguageOrThrow`). Every org-scoped mutation accepting address/phone/locale must call these at the boundary — Zod at the form is not sufficient.
- **Shared i18n constants:** `convex/shared/i18nConstants.ts` (`normalizeChineseScript`, supported locale list, ISO country set mirrored from frontend)
- **FSM transitions:** `convex/lib/fsm.ts` (`assertBookingTransition`, `assertReservationTransition`, `assertBagTransition` — single throw path for all FSM denials)

### Convex — domain
- **Booking resource context:** `convex/bookings.ts` (`buildResourceContext`)
- **Slug bindings (seed):** `convex/shared/seedSlugs.generated.ts` (`SEED_USER_TO_ORG_SLUG`, `SEED_ORG_NAME_BY_SLUG` — generated by `scripts/gen-seed-slugs.ts`)

### Convex — destination scope (area orgs)
- **Visible org IDs:** `convex/lib/destinationScope.ts` (`visibleOrgIds(ctx)` — returns active org ID + every `destinationIds[i]` for area-scoped reads. Use this for any `*.visibleToMe` query that must include destinations the active org subscribes to. Never inline `myOrg.destinationIds ?? []` at the callsite.)
- **Destination org validation:** same file (`assertDestinationOrgsValid(ctx, ids)` — every entry in `organizations.destinationIds` must resolve to an org with `isAreaOrg === true`. Throws `NOT_FOUND` or `VALIDATION:not_an_area_org`.)

### Convex — shared enum validators
- **Literal-union factory:** `convex/shared/enumValidator.ts` (`defineLiteralUnion(values)` — returns `{ values, validator }` with a compile-time guard that the validator round-trips back to the union. Use for any new `as const` array that needs a Convex `v.union(...)` validator. Callers: `venueTypes.ts`, `compressorTypes.ts`, `venueFeatures.ts`. Never repeat the 4-step boilerplate (`map(v.literal) as [...]` cast → `v.union(...)` → `Infer<>` extract → mutual-extends type guard).

### Screen-level data
- **One screen, one query.** Screen-level components consume one aggregation query (e.g. `convex/themes.ts:myThemeContext`), not many entity queries. Sub-components read from context or props. Cap: 3 `useQuery`/`useStableQuery` calls per non-provider component. See `.claude/rules/screen-shaped-queries.md` (auto-loaded) and `Vaults/DiveDispatch/wiki/PatternLibrary/screen-shaped-queries.md`. Enforced by `screen-query-budget.sh` (PostToolUse) + `tests/architecture/query-budget.test.ts` (CI).

## Three copies = extract
If the same logic exists in 3+ places, extract it to a shared file before adding a 4th. If it exists in 2 places, flag it in the PR description or `/gate` output for the next `/design propagate` run — do not add inline comments (per no-comments rule).

## No local type aliases for shared shapes
Do not define a local `type FooProps = { profile: ..., me: ..., create: ..., update: ... }` when `BaseProfileSectionProps` (or an extension of it) fits. Import and extend instead.
