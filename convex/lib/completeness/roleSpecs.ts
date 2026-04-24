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
import { operatorAcceptanceMode, operatorCoverage } from './operatorEvaluators'
import { AOW_REQUIRED_SPECIALTY_COUNT } from '../../shared/activityCatalog'
import { GEAR_TYPES, type GearType } from '../../shared/gearSizing'
import { isGearItemComplete } from '../../shared/gearRequiredFields'
import type { Doc } from '../../_generated/dataModel'

const fleetRoutesHaveDiveSite = (profile: Record<string, unknown>): boolean => {
  const fleet = profile.fleet as Array<{ routes?: Array<{ diveSite: string }> }> | undefined
  return !!fleet?.some((f) => f.routes?.some((r) => r.diveSite))
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
    nestedAddress(),
    associationEvaluator({ minSpecialties: AOW_REQUIRED_SPECIALTY_COUNT }),
    arrayNonEmpty('customerLanguages'),
    operatorAcceptanceMode(),
    operatorCoverage(),
  ],
  Agent: [
    scalarString('name'),
    nestedAddress(),
    associationEvaluator({ minSpecialties: 0 }),
    arrayNonEmpty('customerLanguages'),
    operatorAcceptanceMode(),
    operatorCoverage(),
  ],
  Instructor: [
    scalarString('name'),
    nestedAddress(),
    credentialEvaluator({ requireSpecialties: true }),
    arrayNonEmpty('teachingLanguages'),
  ],
  Boat: [
    scalarString('name'),
    nestedAddress(),
    nestedPathPredicate({ label: 'diveSite', predicate: fleetRoutesHaveDiveSite }),
    fleetEvaluator(),
  ],
  Equipment: [
    scalarString('name'),
    nestedAddress(),
    gearInventoryEvaluator,
  ],
  Venue: [
    scalarString('name'),
    nestedAddress(),
    scalarString('subtype'),
    operatorAcceptanceMode(),
  ],
  Compressor: [
    scalarString('name'),
    nestedAddress(),
    arrayNonEmpty('gasMixes'),
  ],
}
