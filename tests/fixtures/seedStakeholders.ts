/**
 * Stakeholder seed helpers for convex-test integration tests.
 */

import type { Doc } from '../../convex/_generated/dataModel'
import type { SeedCtx } from './seedUsers'

export async function seedStakeholderPreferences(
  ctx: SeedCtx,
  stakeholderId: string,
  overrides: {
    stakeholderType?: Doc<'stakeholderPreferences'>['stakeholderType']
    acceptanceMode?: Doc<'stakeholderPreferences'>['acceptanceMode']
    useNamedUnits?: boolean
    commonLanguageCodes?: string[]
    confirmOnAccept?: boolean
    confirmOnDecline?: boolean
    preferredInstructorSlugs?: string[]
    preferredVenueSlugs?: string[]
    preferredEquipmentSlugs?: string[]
    preferredBoatSlugs?: string[]
    preferredCompressorSlugs?: string[]
    noWorkAfterTime?: string
  } = {},
) {
  return ctx.db.insert('stakeholderPreferences', {
    stakeholderId,
    stakeholderType: overrides.stakeholderType ?? 'DiveCenter',
    acceptanceMode: overrides.acceptanceMode ?? 'Auto',
    useNamedUnits: overrides.useNamedUnits ?? false,
    commonLanguageCodes: overrides.commonLanguageCodes ?? ['en'],
    confirmOnAccept: overrides.confirmOnAccept ?? true,
    confirmOnDecline: overrides.confirmOnDecline ?? true,
    ...(overrides.preferredInstructorSlugs !== undefined ? { preferredInstructorSlugs: overrides.preferredInstructorSlugs } : {}),
    ...(overrides.preferredVenueSlugs !== undefined ? { preferredVenueSlugs: overrides.preferredVenueSlugs } : {}),
    ...(overrides.preferredEquipmentSlugs !== undefined ? { preferredEquipmentSlugs: overrides.preferredEquipmentSlugs } : {}),
    ...(overrides.preferredBoatSlugs !== undefined ? { preferredBoatSlugs: overrides.preferredBoatSlugs } : {}),
    ...(overrides.preferredCompressorSlugs !== undefined ? { preferredCompressorSlugs: overrides.preferredCompressorSlugs } : {}),
    ...(overrides.noWorkAfterTime !== undefined ? { noWorkAfterTime: overrides.noWorkAfterTime } : {}),
  })
}
