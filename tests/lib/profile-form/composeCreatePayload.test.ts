import { describe, it, expect } from 'vitest'
import { composeCreatePayload, needsCreateOverride } from '@/lib/profile-form/composeCreatePayload'
import { ROLE_BY_KEY, ROLE_BY_CLERK_ROLE } from '@/lib/constants/roles'

describe('composeCreatePayload', () => {
  const baseInput = {
    name: 'Test Org',
    email: 'test@example.com',
    phone: '+10000000000',
  }

  it('injects fleet: [] for boat', () => {
    const out = composeCreatePayload(ROLE_BY_KEY['boat'], baseInput)
    expect(out).toMatchObject({ ...baseInput, fleet: [] })
  })

  it('injects associations: [] for dive-center', () => {
    const out = composeCreatePayload(ROLE_BY_KEY['dive-center'], baseInput)
    expect(out).toMatchObject({ ...baseInput, associations: [] })
  })

  it('injects associations: [] for agent', () => {
    const out = composeCreatePayload(ROLE_BY_KEY['agent'], baseInput)
    expect(out).toMatchObject({ ...baseInput, associations: [] })
  })

  it('injects credential: [] for instructor', () => {
    const out = composeCreatePayload(ROLE_BY_KEY['instructor'], baseInput)
    expect(out).toMatchObject({ ...baseInput, credential: [] })
  })

  it('does not inject defaults for compressor', () => {
    const out = composeCreatePayload(ROLE_BY_KEY['compressor'], baseInput)
    expect(out).toEqual(baseInput)
    expect('credential' in out).toBe(false)
    expect('fleet' in out).toBe(false)
    expect('associations' in out).toBe(false)
  })

  it('does not inject defaults for equipment', () => {
    const out = composeCreatePayload(ROLE_BY_KEY['equipment'], baseInput)
    expect(out).toEqual(baseInput)
  })

  it('injects kind + features: [] for venue when venueKind provided', () => {
    const out = composeCreatePayload(ROLE_BY_KEY['venue'], baseInput, { venueKind: 'pool' })
    expect(out).toMatchObject({ ...baseInput, kind: 'pool', features: [] })
  })

  it('throws VENUE_KIND_REQUIRED when venue created without venueKind', () => {
    expect(() => composeCreatePayload(ROLE_BY_KEY['venue'], baseInput)).toThrow('VENUE_KIND_REQUIRED')
  })

  it('does not mutate the input object', () => {
    const input = { ...baseInput }
    const before = JSON.stringify(input)
    composeCreatePayload(ROLE_BY_KEY['boat'], input)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('returns a fresh object even when no defaults to inject', () => {
    const out = composeCreatePayload(ROLE_BY_KEY['compressor'], baseInput)
    expect(out).not.toBe(baseInput)
  })
})

describe('needsCreateOverride', () => {
  it.each([
    ['dive-center', true],
    ['agent', true],
    ['instructor', true],
    ['boat', true],
    ['equipment', false],
    ['compressor', false],
    ['venue', true],
  ] as const)('%s → %s', (key, expected) => {
    expect(needsCreateOverride(ROLE_BY_KEY[key])).toBe(expected)
  })

  it('agrees with dispatcher control flow for all roles', () => {
    for (const config of Object.values(ROLE_BY_CLERK_ROLE)) {
      const result = needsCreateOverride(config)
      const extras = config.contact?.payloadExtras
      const hasDefaults = Boolean(extras && 'createDefaults' in extras)
      const isVenue = config.clerkRole === 'Venue'
      expect(result).toBe(hasDefaults || isVenue)
    }
  })
})
