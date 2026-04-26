import { describe, it, expect } from 'vitest'
import { prefsSchema } from '../prefs-schema'
import type { PreferenceResourceSlugs } from '../resource-tab-requirement'

const HELPER_KEYS: ReadonlyArray<keyof PreferenceResourceSlugs> = [
  'preferredInstructorSlugs',
  'preferredEquipmentSlugs',
  'preferredVenueSlugs',
  'preferredBoatSlugs',
  'preferredCompressorSlugs',
]

describe('prefsSchema ↔ PreferenceResourceSlugs', () => {
  it('every preferred*Slugs schema field has a matching helper entry', () => {
    const schemaKeys = Object.keys(prefsSchema.shape).filter((k) =>
      /^preferred.*Slugs$/.test(k),
    )
    expect(new Set(schemaKeys)).toEqual(new Set(HELPER_KEYS))
  })

  it('every helper key appears in the schema (no stale entries)', () => {
    const schemaKeys = new Set(
      Object.keys(prefsSchema.shape).filter((k) => /^preferred.*Slugs$/.test(k)),
    )
    for (const key of HELPER_KEYS) {
      expect(schemaKeys.has(key as string)).toBe(true)
    }
  })
})
