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

## Two-push contract for required-field tightening

A field cannot transition `v.optional(X)` → `X` in the same push as the backfill that fills it on existing rows. This is enforced by `.claude/hooks/two-push-migration-guard.sh` at commit time.

**Operational sequence**:

1. **Push 1** — add the field as `v.optional(X)`, ship the backfill mutation in `convex/backfill/`, deploy. Run the backfill against the dev deployment.
2. **Verify** — a one-off query confirms zero rows have the field undefined.
3. **Push 2** — tighten the validator to `X` (drop the `v.optional` wrapper). Schema validates against now-clean rows.

**Why two pushes**: schema validation rejects the push if any pre-existing row lacks the new required field, but the backfill that would fill those rows can't deploy until the schema validates. Single-push attempts the impossible. The relax-deploy-backfill-restore rescue pattern works but leaves a transient uncommitted state and is reactive.

**Escape hatch**: a `// migration-manifest-ok: <reason>` comment on the tightened line suppresses the hook for the genuine case where a field was added optional in commit N-1, the backfill ran, and an unrelated backfill addition lands in the same commit as the tightening in commit N.

**Cross-references**:
- `Vaults/DiveDispatch/wiki/Architecture/entities/entity-row-slug.md` "Past failure (2026-04-27)" — the incident that motivated this rule.
- The `role-multirow-by-default` example below — what failed to follow this pattern.

### Example — role-multirow-by-default (2026-04-26 → 2026-04-27, retroactive)

| Field | Entry |
|---|---|
| Name | `role-multirow-by-default` (Phases 2b, 3e, 4.1, 5.1, 5.2/5.3) |
| Scope | `diveCenters`, `boats`, `equipment`, `venues`, `compressors` — slug-everywhere + per-row completeness + soft delete + `entityId`-keyed mutations |
| Schema | `693b0c51` (slug + by_slug × 3), `a20187ff` (profileComplete × 5), `c1f1fd08` (archivedAt × 5) |
| Backend mutations | `entityId`-keyed update + archive on diveCenters/boats/equipment; `mintUniqueEntitySlug` extended to all five entity tables; archive mutation patches `archivedAt` + recomputes role completeness |
| Backend queries | `entityProfilesMine` / `ByUser` / `BySlug` filter `archivedAt`, return `Doc[]`; `directory.listByRole` iterates per-row |
| Frontend schemas | preferred-list, use-operator-defaults, organizer-basic-step, boat-profile-form switched to array consumers |
| Validators | `assertEntitySlug` + `mintUniqueEntitySlug` (`convex/lib/entitySlug.ts`); `evaluateRowCompleteness` (`convex/lib/completeness/perRow.ts`) |
| Tests | 5483 → 5496 (+13: archive ownership/filter, mint -2/-3 collision, multi-row mine returns N, getEntityRowCompleteness, EntityCardList badge, drift sentinel) |
| Seed | `convex/seed.ts:333,349,354` insert slug = `<prefix>-<user.slug>` for the three retrofitted tables; venues + compressors unchanged |
| Backfills | `convex/backfill/entitySlugs.ts` + `convex/backfill/entityProfileComplete.ts` |
| Session log | `Vaults/DiveDispatch/log.md` 2026-04-27T00:39Z (Phase 4.1 + 5 ship) and 2026-04-27T23:43Z (recovery) |
| Vault | `wiki/Architecture/entities/entity-row-slug.md`, `role-kind.md`, `role-completeness-spec.md`; `Lessons.md` "Required-field tightening must follow two-push contract" |
| Legacy sweep | post-Phase 3 deletions: `profileMine`, `profileByUser`, `profileBySlug`, `profileMineMulti`, `profileUpdate`, `profileCreate` (each had a blind `.unique()` on `by_organizationId`) |
| **Box-7 violation** | **Backfill not run against dev before push.** `693b0c51` shipped `slug: v.string()` + the backfill in the same commit; deploy blocked on dev DB rows lacking slug. Recovery used relax-deploy-backfill-restore (transient, uncommitted). |
| Lesson | The two-push contract above would have prevented this entirely. Two-push contract added to this file 2026-04-27 in direct response. |
