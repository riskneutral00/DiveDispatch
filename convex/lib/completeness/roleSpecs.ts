import type { Evaluator } from './types'
import {
  scalarString,
  nestedAddress,
  arrayNonEmpty,
  credentialEvaluator,
  associationEvaluator,
  fleetEvaluator,
  nestedPathPredicate,
  subTableEnumSlots,
} from './evaluators'
import { operatorCoverage } from './operatorEvaluators'
import { AOW_REQUIRED_SPECIALTY_COUNT } from '../../shared/activityCatalog'
import { GEAR_TYPES, type GearType } from '../../shared/gearSizing'
import { isGearItemComplete } from '../../shared/gearRequiredFields'
import type { Doc } from '../../_generated/dataModel'

const fleetRoutesHaveVenues = (profile: Record<string, unknown>): boolean => {
  const fleet = profile.fleet as Array<{ routes?: Array<{ venueIds?: string[] }> }> | undefined
  return !!fleet?.some((f) => f.routes?.some((r) => Array.isArray(r.venueIds) && r.venueIds.length > 0))
}

type EnrichedGearRow = Doc<'equipmentInventory'> & { totalUnits: number }

const gearInventoryEvaluator = subTableEnumSlots<EnrichedGearRow>({
  labelPrefix: 'gear',
  enumValues: GEAR_TYPES,
  fetch: async ({ ctx, userDoc }) => {
    const rows = await ctx.db
      .query('equipmentInventory')
      .withIndex('by_equipmentManagerId', (q) => q.eq('equipmentManagerId', userDoc.slug))
      .collect() // bounded: one EM's inventory, ≤500 rows in v0.1
    return Promise.all(
      rows.map(async (r) => {
        const unit = await ctx.db.get(r.inventoryUnitId)
        return { ...r, totalUnits: unit?.totalUnits ?? 0 }
      }),
    )
  },
  enumOf: (row) => row.gearType,
  itemComplete: (row, gt) => isGearItemComplete(row, gt as GearType),
})

export const ROLE_SPECS: Record<string, Evaluator[]> = {
  DiveCenter: [
    scalarString('name'),
    scalarString('email'),
    scalarString('phone'),
    nestedAddress(),
    associationEvaluator({ minSpecialties: AOW_REQUIRED_SPECIALTY_COUNT }),
    arrayNonEmpty('customerLanguages'),
    operatorCoverage(),
  ],
  Agent: [
    scalarString('name'),
    scalarString('email'),
    scalarString('phone'),
    nestedAddress(),
    associationEvaluator({ minSpecialties: 0 }),
    arrayNonEmpty('customerLanguages'),
    operatorCoverage(),
  ],
  Instructor: [
    scalarString('name'),
    scalarString('email'),
    scalarString('phone'),
    nestedAddress(),
    credentialEvaluator({ requireSpecialties: true }),
    arrayNonEmpty('teachingLanguages'),
  ],
  Boat: [
    scalarString('name'),
    scalarString('email'),
    scalarString('phone'),
    nestedAddress(),
    nestedPathPredicate({ label: 'routeVenues', predicate: fleetRoutesHaveVenues }),
    fleetEvaluator(),
  ],
  Equipment: [
    scalarString('name'),
    scalarString('email'),
    scalarString('phone'),
    nestedAddress(),
    gearInventoryEvaluator,
  ],
  Venue: [
    scalarString('name'),
    scalarString('email'),
    scalarString('phone'),
    nestedAddress(),
    scalarString('kind'),
    nestedPathPredicate({
      label: 'maxDepth',
      predicate: (profile) => {
        const v = profile.maxDepth
        return typeof v === 'number' && Number.isFinite(v) && v > 0
      },
    }),
    nestedPathPredicate({
      label: 'maxCapacity',
      predicate: (profile) => {
        if (profile.kind !== 'pool') return true
        const v = profile.maxCapacity
        return typeof v === 'number' && Number.isFinite(v) && v > 0
      },
    }),
  ],
  Compressor: [
    scalarString('name'),
    scalarString('email'),
    scalarString('phone'),
    nestedAddress(),
    arrayNonEmpty('gasMixes'),
  ],
}
