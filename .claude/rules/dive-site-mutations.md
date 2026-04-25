## Venue mutations from Claude go through `api.admin.upsertVenue`

When Matt asks to add, edit, or feature-toggle a dive site (or any venue), do NOT edit `convex/seedData.ts` and do NOT ask him to use the FE. Use the privileged upsert at `convex/admin/upsertVenue.ts`. It is dev-only (`requireDevEnvironment()`) and lookup-by-`(orgSlug, slug)`.

## Steps

1. **Read first.** Use `mcp__convex__runOneoffQuery` to fetch the org by slug + the venue by `(organizationId, slug)`. Confirm current `features`, `lat`, `lng`, `verified`, `name`. Surface what's there before changing it.
2. **Compute the patch.** For arrays (`features`, `isAllowed`, `notAllowed`), compose the FULL desired array — the upsert replaces, not merges. Adding `wreck` to `[reef]` means sending `["reef","wreck"]`.
3. **Call the mutation.** `mcp__convex__run` with `functionName: "admin/upsertVenue:run"` and the JSON args. Only include fields that change.
4. **Read back to confirm.** Same query as step 1; assert the change landed.
5. **Audit if structural.** If org-level fields changed (`destinationIds`, `isAreaOrg` — not venue features), run `npx tsx scripts/audit-org-relationships.ts` after.

## Defaults and conventions

- `orgSlug` defaults to `south-andaman` (the seeded area org). Confirm before assuming.
- `kind` defaults to `dive_site` for new venues — confirm with Matt before creating a `pool`.
- `verified` defaults to `false` on insert (matches FE-created venues per the round-trip drift documented in `area-org-promotion.md`).
- Required fields on **create**: `name`, `kind`, `address`, `lat`, `lng`. Required fields on **update**: none beyond `orgSlug` + `slug`.
- The 12 valid features: `reef`, `wreck`, `cave`, `wall`, `drift`, `muck`, `altitude`, `lake`, `river`, `quarry`, `night`, `deep`. Adding new features is a separate ticket (edit `convex/shared/venueFeatures.ts`).

## When to refuse

- If `ENVIRONMENT !== 'development'` on the deployment, the mutation throws. Don't try to run against prod from a Claude session — that requires a separate UI-backed flow with `requireOrgAdmin`.
- If the venue slug is ambiguous (Matt says "King Cruiser" but no exact slug match), confirm with Matt before guessing. Don't fuzzy-match.
- If Matt asks for a non-venue mutation (compressor, boat, equipment) that doesn't yet have an admin upsert, propose adding `convex/admin/upsert<Entity>.ts` following this same pattern instead of editing seed.

## Cross-refs

- `Vaults/DiveDispatch/wiki/Architecture/entities/dive-site-mutation-protocol.md` — the entity for this workflow.
- `Vaults/DiveDispatch/wiki/Architecture/entities/area-org-promotion.md` — sibling pattern.
- `Vaults/DiveDispatch/wiki/PatternLibrary/dev-tool-mutation-cli.md` — reusable pattern.
