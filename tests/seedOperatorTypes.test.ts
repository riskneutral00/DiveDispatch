import { describe, it, expect } from 'vitest'
import { PARKED_STAKEHOLDERS, ANDAMAN_EXPLORER, CORAL_BAY_RESORT, AMANDA } from '../convex/seedData'
import { BOOKING_CONFIGS } from '../convex/seedBookingData'
import packageJson from '../package.json'

describe('Non-DiveCenter operator seed data', () => {

  describe('Liveaboard operator', () => {
    it('exists in PARKED_STAKEHOLDERS', () => {
      expect(PARKED_STAKEHOLDERS).toContainEqual(
        expect.objectContaining({ user: expect.objectContaining({ slug: ANDAMAN_EXPLORER.user.slug }) }),
      )
    })

    it('has a user record with all required fields', () => {
      const user = ANDAMAN_EXPLORER.user
      expect(user.slug).toBe('k8lv3a')
      expect(user.email).toBe('andaman-explorer+clerk_test@divedispatch.dev')
      expect(user.name).toBe('Chaiwat Meesuk')
      expect(user.firstName).toBe('Chaiwat')
      expect(user.lastName).toBe('Meesuk')
      expect(user.phone).toBe('+66-81-234-5011')
    })

    it('has the Liveaboard role assigned', () => {
      expect(ANDAMAN_EXPLORER.roles).toContainEqual({ role: 'Liveaboard' })
    })

    it('has a liveaboard profile with required fields', () => {
      const profile = ANDAMAN_EXPLORER.liveaboard!
      expect(profile.name).toBe('Andaman Explorer')
      expect(profile.placeName).toBe('Phuket')
      expect(profile.country).toBe('Thailand')
      expect(profile.lat).toBe(7.8804)
      expect(profile.lng).toBe(98.3923)
      expect(profile.email).toBe('andaman-explorer@divedispatch.dev')
      expect(profile.phone).toBe('+66-76-392-001')
      expect(profile.verified).toBe(true)
    })

    it('has at least one booking config', () => {
      const configs = BOOKING_CONFIGS.filter((c) => c.ownerSlug === ANDAMAN_EXPLORER.user.slug)
      expect(configs.length).toBeGreaterThanOrEqual(1)
    })

    it('booking config uses Liveaboard ownerType', () => {
      const config = BOOKING_CONFIGS.find((c) => c.ownerSlug === ANDAMAN_EXPLORER.user.slug)
      expect(config!.ownerType).toBe('Liveaboard')
    })
  })

  describe('DiveResort operator', () => {
    it('exists in PARKED_STAKEHOLDERS', () => {
      expect(PARKED_STAKEHOLDERS).toContainEqual(
        expect.objectContaining({ user: expect.objectContaining({ slug: CORAL_BAY_RESORT.user.slug }) }),
      )
    })

    it('has a user record with all required fields', () => {
      const user = CORAL_BAY_RESORT.user
      expect(user.slug).toBe('j2dn9f')
      expect(user.email).toBe('coral-bay-resort+clerk_test@divedispatch.dev')
      expect(user.name).toBe('Supattra Laohakul')
      expect(user.firstName).toBe('Supattra')
      expect(user.lastName).toBe('Laohakul')
      expect(user.phone).toBe('+66-81-234-5012')
    })

    it('has the DiveResort role assigned', () => {
      expect(CORAL_BAY_RESORT.roles).toContainEqual({ role: 'DiveResort' })
    })

    it('has a diveResort profile with required fields', () => {
      const profile = CORAL_BAY_RESORT.diveResort!
      expect(profile.name).toBe('Coral Bay Resort')
      expect(profile.placeName).toBe('Phuket')
      expect(profile.country).toBe('Thailand')
      expect(profile.lat).toBe(7.8804)
      expect(profile.lng).toBe(98.3923)
      expect(profile.email).toBe('coral-bay-resort@divedispatch.dev')
      expect(profile.phone).toBe('+66-76-393-001')
      expect(profile.verified).toBe(true)
    })

    it('has at least one booking config', () => {
      const configs = BOOKING_CONFIGS.filter((c) => c.ownerSlug === CORAL_BAY_RESORT.user.slug)
      expect(configs.length).toBeGreaterThanOrEqual(1)
    })

    it('booking config uses DiveResort ownerType', () => {
      const config = BOOKING_CONFIGS.find((c) => c.ownerSlug === CORAL_BAY_RESORT.user.slug)
      expect(config!.ownerType).toBe('DiveResort')
    })
  })

  describe('Agent operator', () => {
    it('exists in PARKED_STAKEHOLDERS', () => {
      expect(PARKED_STAKEHOLDERS).toContainEqual(
        expect.objectContaining({ user: expect.objectContaining({ slug: AMANDA.user.slug }) }),
      )
    })

    it('has a user record with all required fields', () => {
      const user = AMANDA.user
      expect(user.slug).toBe('r5yz4q')
      expect(user.email).toBe('amanda+clerk_test@divedispatch.dev')
      expect(user.name).toBe('Amanda Chen')
      expect(user.firstName).toBe('Amanda')
      expect(user.lastName).toBe('Chen')
      expect(user.phone).toBe('+66-81-234-5010')
    })

    it('has the Agent role assigned', () => {
      expect(AMANDA.roles).toContainEqual({ role: 'Agent' })
    })

    it('has an agent profile with required fields', () => {
      const profile = AMANDA.agent!
      expect(profile.name).toBe('Amanda')
      expect(profile.placeName).toBe('Phuket')
      expect(profile.country).toBe('Thailand')
      expect(profile.lat).toBe(7.8804)
      expect(profile.lng).toBe(98.3923)
      expect(profile.email).toBe('amanda@divedispatch.dev')
      expect(profile.phone).toBe('+66-81-555-0012')
      expect(profile.verified).toBe(true)
    })

    it('has at least one booking config', () => {
      const configs = BOOKING_CONFIGS.filter((c) => c.ownerSlug === AMANDA.user.slug)
      expect(configs.length).toBeGreaterThanOrEqual(1)
    })

    it('booking config uses Agent ownerType', () => {
      const config = BOOKING_CONFIGS.find((c) => c.ownerSlug === AMANDA.user.slug)
      expect(config!.ownerType).toBe('Agent')
    })

    it('booking config is structurally valid', () => {
      const config = BOOKING_CONFIGS.find((c) => c.ownerSlug === AMANDA.user.slug)!
      expect(config.ownerName).toBe('Amanda')
      expect(config.count).toBeGreaterThanOrEqual(1)
      expect(Object.keys(config.activityMix).length).toBeGreaterThanOrEqual(1)
      expect(Object.keys(config.statusMix).length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('All stakeholder slugs are unique', () => {
    it('no duplicate slugs', () => {
      const slugs = PARKED_STAKEHOLDERS.map((s) => s.user.slug)
      expect(new Set(slugs).size).toBe(slugs.length)
    })
  })

  describe('All stakeholder emails are unique', () => {
    it('no duplicate emails', () => {
      const emails = PARKED_STAKEHOLDERS.map((s) => s.user.email)
      expect(new Set(emails).size).toBe(emails.length)
    })
  })
})

describe('Seed guard integrity', () => {
  const scripts = packageJson.scripts as Record<string, string>

  it('does not expose a standalone wipe:all script', () => {
    expect(scripts['wipe:all']).toBeUndefined()
  })

  it('seed:force chains wipe, seed, clerk sync, and verify', () => {
    const seedForce = scripts['seed:force']
    expect(seedForce).toBeDefined()
    expect(seedForce).toContain('seed:wipeAll')
    expect(seedForce).toContain('seed:seedAll')
    expect(seedForce).toContain('seed-clerk')
    expect(seedForce).toContain('seed:seedVerify')
  })

  it('no script calls seed:wipeAll in isolation', () => {
    for (const [name, command] of Object.entries(scripts)) {
      if (command.includes('seed:wipeAll') && !command.includes('seed:seedAll')) {
        throw new Error(
          `Script "${name}" calls seed:wipeAll without seed:seedAll — bypasses seed guard`,
        )
      }
    }
  })
})
