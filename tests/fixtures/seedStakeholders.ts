import type { Doc } from '../../convex/_generated/dataModel'
import type { SeedCtx } from './seedUsers'

export async function seedStakeholderPreferences(
  ctx: SeedCtx,
  stakeholderId: string,
  overrides: {
    stakeholderType?: Doc<'stakeholderPreferences'>['stakeholderType']
    autoAccept?: boolean
    useNamedUnits?: boolean
    commonLanguageCodes?: string[]
    confirmOnAccept?: boolean
    confirmOnDecline?: boolean
    preferredInstructorSlugs?: string[]
    preferredVenueSlugs?: string[]
    preferredEquipmentSlugs?: string[]
    preferredBoatSlugs?: string[]
    preferredCompressorSlugs?: string[]
  } = {},
) {
  return ctx.db.insert('stakeholderPreferences', {
    stakeholderId,
    stakeholderType: overrides.stakeholderType ?? 'DiveCenter',
    autoAccept: overrides.autoAccept ?? true,
    useNamedUnits: overrides.useNamedUnits ?? false,
    commonLanguageCodes: overrides.commonLanguageCodes ?? ['en'],
    confirmOnAccept: overrides.confirmOnAccept ?? true,
    confirmOnDecline: overrides.confirmOnDecline ?? true,
    ...(overrides.preferredInstructorSlugs !== undefined ? { preferredInstructorSlugs: overrides.preferredInstructorSlugs } : {}),
    ...(overrides.preferredVenueSlugs !== undefined ? { preferredVenueSlugs: overrides.preferredVenueSlugs } : {}),
    ...(overrides.preferredEquipmentSlugs !== undefined ? { preferredEquipmentSlugs: overrides.preferredEquipmentSlugs } : {}),
    ...(overrides.preferredBoatSlugs !== undefined ? { preferredBoatSlugs: overrides.preferredBoatSlugs } : {}),
    ...(overrides.preferredCompressorSlugs !== undefined ? { preferredCompressorSlugs: overrides.preferredCompressorSlugs } : {}),
  })
}
