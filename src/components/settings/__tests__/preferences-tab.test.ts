/**
 * preferences-tab — fromProfile / toPayload mapping tests
 *
 * Unit tests for the pure mapping functions extracted from PreferencesTab.
 * These verify that Convex user records are correctly mapped to form state
 * and that form state is correctly mapped to mutation payloads.
 */

import { describe, it, expect } from 'vitest'
import {
  preferencesTabSchema,
  preferencesFromUser,
  preferencesToPayload,
  PREFERENCES_DEFAULTS,
  type PreferencesValues,
} from '../preferences-tab'

// ── fromProfile ─────────────────────────────────────────────────────────────

describe('preferencesFromUser', () => {
  it('maps a user record with appLanguage to form state', () => {
    const user = {
      appLanguage: 'fr-FR',
    }

    const result = preferencesFromUser(user as Record<string, unknown>)

    expect(result).toEqual({
      appLanguage: 'fr-FR',
    })
  })

  it('defaults appLanguage to en when missing', () => {
    const user = {}

    const result = preferencesFromUser(user as Record<string, unknown>)

    expect(result).toEqual({
      appLanguage: 'en',
    })
  })

  it('defaults appLanguage to en when null', () => {
    const user = { appLanguage: null }

    const result = preferencesFromUser(user as Record<string, unknown>)

    expect(result).toEqual(PREFERENCES_DEFAULTS)
  })
})

// ── toPayload ───────────────────────────────────────────────────────────────

describe('preferencesToPayload', () => {
  it('maps form state to mutation args', () => {
    const form: PreferencesValues = {
      appLanguage: 'th-TH',
    }

    const result = preferencesToPayload(form)

    expect(result).toEqual({
      appLanguage: 'th-TH',
    })
  })

  it('uses default language when form has default', () => {
    const result = preferencesToPayload(PREFERENCES_DEFAULTS)

    expect(result).toEqual({
      appLanguage: 'en',
    })
  })

  it('does not include a role field in the payload', () => {
    const form: PreferencesValues = {
      appLanguage: 'fr',
    }

    const result = preferencesToPayload(form)

    expect(result).not.toHaveProperty('role')
  })
})

// ── Schema validation ───────────────────────────────────────────────────────

describe('preferencesTabSchema', () => {
  it('accepts a valid form with language code', () => {
    const valid: PreferencesValues = { appLanguage: 'en-GB' }
    expect(preferencesTabSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts a valid form with short language code', () => {
    const valid: PreferencesValues = { appLanguage: 'en' }
    expect(preferencesTabSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty appLanguage', () => {
    const invalid = { appLanguage: '' }
    expect(preferencesTabSchema.safeParse(invalid).success).toBe(false)
  })
})
