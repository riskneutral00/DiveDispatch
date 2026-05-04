---
description: DRY-first discipline — check for existing implementations before creating new ones
---

## Check before you create
Before defining a new constant, type, schema, or utility function, grep `src/lib/constants/`, `src/lib/utils/`, `src/lib/schemas/`, `src/lib/profile-form/`, and `convex/lib/` for an existing implementation. If one exists, import it. Do not create a local copy.

## Canonical sources

### Frontend — constants + utils
- **Role config:** `src/lib/constants/roles.ts` is the only role registry. Each role entry includes `tableName`, `profileTabs`, `roleClass`, plus `api: { mine, create, update, idArg }` (Convex `FunctionReference`s) and optional `contact: { schema, nameLabel?, languageKey?, inheritFromOtherRoles?, payloadExtras }` for default contact rendering. `payloadExtras` is a discriminated union (`kind: 'agent' | 'dive-center' | 'instructor' | 'boat' | 'equipment' | 'compressor' | 'venue'`), never `Record<string, unknown>`. `OVERLAY_ONLY_SECTIONS` lives here too. Never define a parallel `Record<RoleKey, …>` or `Record<ClerkRole, …>` outside `src/lib/constants/roles.ts` (or `src/components/profiles/role-section-registry.tsx` for component bindings, the one allowed exception due to the lib→components layering rule). Never write an exhaustive `switch (role)` or chained `if (role === ...)` over more than 2 RoleKey/ClerkRole literals outside those two files. Convex mutations dispatched dynamically must go through `useEntityMutation(role)` (`src/lib/hooks/use-entity-mutation.ts`) — the single boundary where `Record<string, unknown>` typing is acceptable. Enforced by `tests/architecture/role-registry-sealed.test.ts`.
- **Boat types:** `src/lib/constants/boat-types.ts`
- **Gas mixes:** `src/lib/constants/gas-mixes.ts`
- **i18n constants:** `src/lib/constants/i18n.ts` (`COUNTRY_CODES`, `LANGUAGE_CODES`, `LOCALE_CODES`, `E164_REGEX`, `isValidCountryCode`, `isValidPhoneE164`, `isValidLocale`, `isValidLanguageCode`, `normalizePhone`)
- **Supported locales:** `src/lib/constants/locales.ts` (`SUPPORTED_LOCALES`, `SupportedLocale`)
- **Dive languages:** `src/lib/constants/dive-languages.ts` (`ALL_LANGUAGES`, `findLanguageByCode(code)`, `languageToCode`, `resolveLanguages`, `POPULAR_LANGUAGE_CODES`, `CHINESE_SCRIPT_LABELS`). `findLanguageByCode` is the only call into `ALL_LANGUAGES.find` — never reimplement at a callsite.
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
- **Role-kind registry:** `convex/shared/roleKinds.ts` is the source of truth. `PERSON_ROLES` (Instructor, Agent — user IS the entity, 1 forever) and `ENTITY_ROLES` (DiveCenter, Equipment, Boat, Compressor, Venue — user OWNS entities, 0..N forever). `ROLE_SPECS[role]` returns `{ table, kind }`. Use `isPersonRole(role)` / `isEntityRole(role)` to dispatch on dynamic role strings. See `[[role-kind]]` vault entity for the full taxonomy.
- **Profile helpers (typed):** `convex/lib/profileHelpers.ts` exports kind-bounded variants. **Do not reach for raw `ctx.db.query(<entityTable>).unique()` — blocked by `tests/architecture/no-blind-unique-on-entity-tables.test.ts`.**
  - PERSON reads: `personProfileMine`, `personProfileByUser`, `personProfileBySlug` — all return `Doc | null`.
  - ENTITY reads: `entityProfilesMine`, `entityProfilesByUser` — return `Doc[]`. `entityProfileBySlug` returns `Doc | null` via the `by_slug` index (the only place `.unique()` on an entity table is correct).
  - PERSON writes: `personProfileUpdate` (1:1 forever, single-row patch), `personProfileCreate` (idempotent — returns existing single row).
  - ENTITY writes: `entityProfileUpdate(ctx, entityId, args, role, actor?)` — caller passes the row id explicitly; helper asserts org ownership. `entityProfileCreate` is idempotent on slug (existing row with matching slug returns its `_id`).
  - Names: `personProfileName(ctx, userId, role)` → `string`. `entityProfileNames(ctx, userId, role)` → `string[]`. `getProfileName(ctx, userId, role)` is the dynamic-role dispatch shim — branches internally; use when the role is only known at runtime (audit/notification paths).
  - All write helpers accept an optional final `actor: { user, identity }` param to skip a redundant gateway lookup when the caller has already authorized.
- **Role-to-table compat:** `ROLE_TABLE_MAP` is re-derived from `ROLE_SPECS` and remains for legitimate dispatch sites (`directory.ts`, `userRoles.ts`, `seedExport.ts`, `lib/profileCompleteness.ts`, `lib/completeness/resolveProfile.ts`, `reservationsMutations.ts`). Sealed by `tests/architecture/role-table-map-sealed.test.ts` — new callsites must use the typed helpers above.
- **DELETED helpers** (post-Phase 3 of role-multirow-by-default; do not re-introduce): `profileMine`, `profileByUser`, `profileBySlug`, `profileMineMulti`, `profileUpdate`, `profileCreate`. Each had a blind `.unique()` on `by_organizationId` that crashed for multi-row entity roles.
- **Entity-row slugs:** every entity-role table (compressors, venues, diveCenters, boats, equipment) has `slug: v.string()` + `by_slug` index. Validators in `convex/lib/entitySlug.ts`: `assertEntitySlug` (non-empty, kebab-case, 3-64 chars), `deriveDefaultEntitySlug(table, userSlug)`, `mintUniqueEntitySlug(ctx, table, baseName)`. See `[[entity-row-slug]]` vault entity.
- **Per-row completeness:** every entity-role row has `profileComplete: v.optional(v.boolean())`. `userRoles.profileComplete` is the strict-AND of every row owned by that user in that role. `setRoleProfileComplete` is kind-aware and re-evaluates per-row via `convex/lib/completeness/perRow.ts` `evaluateRowCompleteness`.
- **Per-user role collection:** `convex/lib/userRoleHelpers.ts` (`getAllUserRoles` — replaces inline `.withIndex('by_userId').collect()` on `userRoles`; `insertUserRole` — every userRoles insert site uses this. `organizationId` is a **required** parameter; the caller must resolve org first.)
- **Per-user-per-org membership:** `convex/lib/userRoleHelpers.ts` (`findMembership(ctx, userId, organizationId)` — single-row lookup, returns `Doc<'userRoles'> | null`. Used by `auth-model.md` Rule 11 active-org gates. `getUserRolesInOrg(ctx, userId, organizationId)` — multi-row variant for patching/deleting all of a user's roles within one org. Never inline `userRoles.withIndex('by_userId').filter(... organizationId ...)` — drift caught by `tests/architecture/membership-helper.test.ts`.)
- **User org assignment:** `convex/lib/userOrg.ts` (`setUserOrganization(ctx, userId, orgId)` — single writer for `user.organizationId`. Patches the user AND syncs every `userRoles.organizationId` in the same mutation. Never call `ctx.db.patch(userId, { organizationId })` directly — the denorm on `userRoles` will drift. Callers: `ensurePersonalOrg`, `createUser` activeOrg paths, `organizations.upsertFromWebhook` creator patch, `seed` paths.)

### Convex — auth gateway
- **Primary entry points:** `convex/lib/auth.ts` — `authorize()` is the single entry point per `Architecture/auth-model.md` Rule 1. `authorizeWithRole()` is the composite when a mutation needs `authorize` + `requireActiveRole` + optional readiness. `getRequiredUserBySlug()` replaces slug-lookup + NOT_FOUND throw. `assertOrgOwnership()` asserts a resource's `organizationId` matches the active org. Internal helpers `requireAuth`, `assertOwnership`, `requireOwnerOrResourceAccess` are consumed by `authorize()` — do NOT call them directly in mutations.
- **Active-org resolution:** `convex/lib/activeOrg.ts` (`getActiveOrg` — two-path resolution (JWT claim or membership-gated denorm fallback) per Rule 11, `requireOrgAdmin` — composite active-org + admin-role assertion, `tryGetActiveOrg` — non-throwing variant, `readOrgClaims` — extract `{orgId, orgRole, orgSlug}` from the JWT identity). The fallback path requires a matching `userRoles` row (`userId`, `organizationId`) — never trust `users.organizationId` denorm alone. See `Architecture/auth-model.md` Rules 8, 9, 11, 13 and entities `[[organization]]` + `[[clerk-convex-org-sync]]`.
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
