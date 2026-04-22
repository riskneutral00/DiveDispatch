## Migrations aren't done until the manifest is green

Every schema or data-shape migration touches more surfaces than the schema file. A migration is done only when every box below is checked. Missing a box silently is how drift enters — and drift is only caught later, in production, by a user hitting an orphan row.

When starting a migration, paste this checklist into the plan or ticket and fill it in as you go. When ending a migration, the checklist becomes the audit trail in the session log.

### Manifest

| Field | Entry |
|---|---|
| **Name** | short label, e.g. `venues-multi-row` |
| **Scope** | tables / routes / UI surfaces touched |
| **Schema changes** | diff of `convex/schema.ts` indexes + fields |
| **Backend mutations updated** | list of `convex/*.ts` files + specific exported mutation names |
| **Backend queries updated** | list of reads that depend on the migrated shape |
| **Frontend schemas updated** | `src/lib/schemas/*`, `src/lib/validation/*` shape changes |
| **Validators added/wired** | new / wired `assert*` calls; any new hook added |
| **Tests added** | lock tests that would have caught the bug this migration fixes |
| **Seed / fixtures updated** | `convex/seedData.ts`, `convex/seedInstructorData.ts`, `tests/fixtures/**` |
| **Session log accurate** | vault `log.md` entry reflects count of sites actually touched |
| **Vault entities added/updated** | `wiki/Architecture/entities/*.md` for new concepts |
| **Legacy branches swept** | grep for old table/field names — residual references to the old shape are a test-passing hazard |

### Example — venues Pool+DiveSite collapse (2026-04-21, retroactive)

| Field | Entry |
|---|---|
| Name | `venues-multi-row` |
| Scope | `venues` table (multi-row per org); `pools`, `diveSites` deprecated; inventoryUnits rekeyed |
| Schema | `venues.slug` required + `by_slug`; `.unique()` removed from `venues` |
| Backend mutations | `venues.ts` create/update/remove; 6th-site safeDbOps wrap on venue unit patches |
| Backend queries | `venues.mine` returns array (not doc); `venues.bySlug` added |
| Frontend schemas | `ventureCapabilitiesSection` + `VenueEditDialog` consume the array |
| Validators | venues.create/update now call `assertPhoneE164` + `assertCountryCode`; `validateContactInput` added to `profileHelpers` |
| Tests | `tests/venues.test.ts` — 27 cases across create/update/remove/mine/bySlug + profileComplete denorm |
| Seed | Rene's Marriott venue backfilled via `migrations.backfillVenueSlugs`; fixtures use new shape |
| Session log | `log.md` 2026-04-21T17:10 + follow-up audit entries |
| Vault | `wiki/Architecture/entities/venue-model.md` updated; `organization.md` noted the `venues` array shape |
| Legacy sweep | `build-submit-payload.ts:199-204` + `compute-date-range.ts:41-42` — residual `resourceType: 'Pool'` caught late via /gate; migration manifest would have surfaced this on first pass |

### Apply

- Write the manifest **before** editing the schema file.
- Check every row before declaring the migration done.
- A session log that says `"5 sites"` when it should say `"6 sites"` is a governance defect. Correct the log inline and note the correction.
- If you find a missing row mid-migration, stop and expand scope or split the migration; do not leave it half-applied.
