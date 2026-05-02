import { describe, it, expect } from 'vitest'
import {
  isE164Shape,
  isValidIsoCountryCode,
  isValidSupportedLocale,
  SUPPORTED_LOCALE_CODES,
} from '../convex/shared/i18nConstants'
import { ALL_PURGATORY_STAKEHOLDERS as ALL_STAKEHOLDERS } from '../convex/purgatoryData'
import { ALL_PURGATORY_INSTRUCTORS as ALL_INSTRUCTORS } from '../convex/purgatoryData'

const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/

function isValidLanguageCode(code: unknown): code is string {
  return typeof code === 'string' && LANGUAGE_CODE_PATTERN.test(code)
}

type RoleBlock = {
  phone?: unknown
  address?: { city?: unknown; country?: unknown }
}

function getLocationRoleBlock(stakeholder: typeof ALL_STAKEHOLDERS[number]): RoleBlock | undefined {
  const s = stakeholder as unknown as Record<string, unknown>
  for (const key of ['diveCenter', 'agent', 'boat', 'equipment', 'venue', 'compressor', 'liveaboard', 'diveResort', 'diveHostel', 'pool', 'instructor'] as const) {
    const block = s[key]
    if (block && typeof block === 'object') return block as RoleBlock
  }
  return undefined
}

describe('seedFixtures integrity — stakeholders', () => {
  it('ALL_STAKEHOLDERS is an array', () => {
    expect(Array.isArray(ALL_STAKEHOLDERS)).toBe(true)
  })

  for (const stakeholder of ALL_STAKEHOLDERS) {
    const slug = stakeholder.user.slug
    const userPhone = stakeholder.user.phone
    const appLanguage = stakeholder.user.appLanguage
    const customerLanguages = (stakeholder.user as { customerLanguages?: string[] }).customerLanguages

    it(`${slug} — user.phone is E.164`, () => {
      expect(isE164Shape(userPhone), `phone "${userPhone}" must be E.164`).toBe(true)
    })

    it(`${slug} — user.appLanguage in supported set`, () => {
      expect(
        isValidSupportedLocale(appLanguage),
        `appLanguage "${appLanguage}" must be in ${[...SUPPORTED_LOCALE_CODES].join(',')}`,
      ).toBe(true)
    })

    if (customerLanguages) {
      it(`${slug} — user.customerLanguages all valid`, () => {
        for (const code of customerLanguages) {
          expect(isValidLanguageCode(code), `customerLanguage "${code}" invalid`).toBe(true)
        }
      })
    }

    const roleBlock = getLocationRoleBlock(stakeholder)
    if (roleBlock) {
      it(`${slug} — role block phone is E.164`, () => {
        expect(isE164Shape(roleBlock.phone), `role phone "${roleBlock.phone}" must be E.164`).toBe(true)
      })

      it(`${slug} — role block address.country is ISO 3166-1 alpha-2`, () => {
        const country = roleBlock.address?.country
        expect(
          isValidIsoCountryCode(country),
          `role address.country "${String(country)}" must be ISO alpha-2`,
        ).toBe(true)
      })

      it(`${slug} — role block address.city non-empty`, () => {
        const city = roleBlock.address?.city
        expect(typeof city === 'string' && city.length > 0, `role address.city must be non-empty`).toBe(true)
      })
    }
  }
})

describe('seedFixtures integrity — instructors', () => {
  it('ALL_INSTRUCTORS is an array', () => {
    expect(Array.isArray(ALL_INSTRUCTORS)).toBe(true)
  })

  for (const instructor of ALL_INSTRUCTORS) {
    const slug = instructor.user.slug
    const userPhone = instructor.user.phone
    const appLanguage = instructor.user.appLanguage
    const teachingLanguages = (instructor as unknown as Record<string, unknown>).instructor as { teachingLanguages?: string[] } | undefined

    it(`${slug} — user.phone is E.164`, () => {
      expect(isE164Shape(userPhone), `phone "${userPhone}" must be E.164`).toBe(true)
    })

    it(`${slug} — user.appLanguage in supported set`, () => {
      expect(isValidSupportedLocale(appLanguage), `appLanguage "${appLanguage}" must be supported`).toBe(true)
    })

    const roleBlock = getLocationRoleBlock(instructor)
    if (roleBlock) {
      it(`${slug} — instructor role block phone is E.164`, () => {
        expect(isE164Shape(roleBlock.phone), `phone "${roleBlock.phone}" must be E.164`).toBe(true)
      })

      it(`${slug} — instructor role block address.country is ISO`, () => {
        const country = roleBlock.address?.country
        expect(isValidIsoCountryCode(country), `country "${String(country)}" must be ISO alpha-2`).toBe(true)
      })
    }

    if (teachingLanguages?.teachingLanguages) {
      it(`${slug} — teachingLanguages all valid`, () => {
        for (const code of teachingLanguages.teachingLanguages!) {
          expect(isValidLanguageCode(code), `teachingLanguage "${code}" invalid`).toBe(true)
        }
      })
    }
  }
})
