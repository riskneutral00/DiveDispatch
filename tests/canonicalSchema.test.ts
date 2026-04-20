import { describe, it, expect } from 'vitest'
import Ajv, { type ErrorObject } from 'ajv'
import addFormats from 'ajv-formats'
import canonicalSchema from '../ultraplan/canonical.schema.json'
import canonical from '../ultraplan/canonical.json'

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(canonicalSchema)

describe('canonical.json ↔ canonical.schema.json', () => {
  it('validates clean', () => {
    const ok = validate(canonical)
    if (!ok) {
      const errors: ErrorObject[] = validate.errors ?? []
      const preview = errors.slice(0, 5).map((e) => `${e.instancePath} ${e.message}`).join('\n')
      throw new Error(`ajv validation failed (${errors.length} errors):\n${preview}`)
    }
    expect(ok).toBe(true)
  })

  it('every non-customer stakeholder has clerkOrgIdHint', () => {
    const stakeholders = (canonical as { stakeholders: Record<string, { role?: string; clerkOrgIdHint?: string }> }).stakeholders
    for (const [key, entry] of Object.entries(stakeholders)) {
      if (entry.role === 'Customer') continue
      expect(entry.clerkOrgIdHint, `stakeholder ${key} missing clerkOrgIdHint`).toBeTruthy()
    }
  })

  it('no legacy country strings remain', () => {
    const raw = JSON.stringify(canonical)
    expect(raw).not.toMatch(/"country":\s*"Thailand"/)
    expect(raw).not.toMatch(/"country":\s*"United States"/)
  })

  it('every phone is E.164', () => {
    const raw = JSON.stringify(canonical)
    const phoneMatches = raw.match(/"phone":\s*"([^"]+)"/g) ?? []
    for (const match of phoneMatches) {
      const value = match.replace(/"phone":\s*"/, '').replace(/"$/, '')
      expect(value, `phone violates E.164: ${value}`).toMatch(/^\+[1-9]\d{1,14}$/)
    }
  })

  it('every appLanguage is a supported locale', () => {
    const supported = new Set(['en', 'zh-CN', 'zh-TW', 'th', 'fr', 'ko'])
    const raw = JSON.stringify(canonical)
    const appLangMatches = raw.match(/"appLanguage":\s*"([^"]+)"/g) ?? []
    for (const match of appLangMatches) {
      const value = match.replace(/"appLanguage":\s*"/, '').replace(/"$/, '')
      expect(supported.has(value), `appLanguage unsupported: ${value}`).toBe(true)
    }
  })
})
