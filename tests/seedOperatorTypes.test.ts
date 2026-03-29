// Tests that non-DiveCenter operator types (Liveaboard, DiveResort, Agent) exist in seed data
// and have correct structure for seeding.

import { describe, it, expect } from 'vitest'
import { ALL_STAKEHOLDERS } from '../convex/seedData'
import { BOOKING_CONFIGS } from '../convex/seedBookingData'
import packageJson from '../package.json'

describe('Non-DiveCenter operator seed data', () => {
  const liveaboardStakeholder = ALL_STAKEHOLDERS.find(
    (s) => s.roles?.some((r) => r.role === 'Liveaboard'),
  )

  const diveResortStakeholder = ALL_STAKEHOLDERS.find(
    (s) => s.roles?.some((r) => r.role === 'DiveResort'),
  )

  const agentStakeholder = ALL_STAKEHOLDERS.find(
    (s) => s.roles?.some((r) => r.role === 'Agent'),
  )

  describe('Liveaboard operator', () => {
    it('exists in ALL_STAKEHOLDERS', () => {
      expect(liveaboardStakeholder).toBeTruthy()
    })

    it('has a user record with all required fields', () => {
      const user = liveaboardStakeholder!.user
      expect(user.slug).toBeTruthy()
      expect(user.email).toContain('@divedispatch.dev')
      expect(user.name).toBeTruthy()
      expect(user.firstName).toBeTruthy()
      expect(user.lastName).toBeTruthy()
      expect(user.businessName).toBeTruthy()
      expect(user.phone).toBeTruthy()
    })

    it('has the Liveaboard role assigned', () => {
      const roles = liveaboardStakeholder!.roles!
      expect(roles).toContainEqual({ role: 'Liveaboard' })
    })

    it('has a liveaboard profile with required fields', () => {
      const profile = liveaboardStakeholder!.liveaboard
      expect(profile).toBeTruthy()
      expect(profile!.name).toBeTruthy()
      expect(profile!.placeName).toBeTruthy()
      expect(profile!.country).toBeTruthy()
      expect(typeof profile!.lat).toBe('number')
      expect(typeof profile!.lng).toBe('number')
      expect(profile!.email).toContain('@divedispatch.dev')
      expect(profile!.phone).toBeTruthy()
      expect(profile!.verified).toBe(true)
    })

    it('has at least one booking config', () => {
      const slug = liveaboardStakeholder!.user.slug
      const configs = BOOKING_CONFIGS.filter((c) => c.ownerSlug === slug)
      expect(configs.length).toBeGreaterThanOrEqual(1)
    })

    it('booking config uses Liveaboard ownerType', () => {
      const slug = liveaboardStakeholder!.user.slug
      const config = BOOKING_CONFIGS.find((c) => c.ownerSlug === slug)
      expect(config!.ownerType).toBe('Liveaboard')
    })
  })

  describe('DiveResort operator', () => {
    it('exists in ALL_STAKEHOLDERS', () => {
      expect(diveResortStakeholder).toBeTruthy()
    })

    it('has a user record with all required fields', () => {
      const user = diveResortStakeholder!.user
      expect(user.slug).toBeTruthy()
      expect(user.email).toContain('@divedispatch.dev')
      expect(user.name).toBeTruthy()
      expect(user.firstName).toBeTruthy()
      expect(user.lastName).toBeTruthy()
      expect(user.businessName).toBeTruthy()
      expect(user.phone).toBeTruthy()
    })

    it('has the DiveResort role assigned', () => {
      const roles = diveResortStakeholder!.roles!
      expect(roles).toContainEqual({ role: 'DiveResort' })
    })

    it('has a diveResort profile with required fields', () => {
      const profile = diveResortStakeholder!.diveResort
      expect(profile).toBeTruthy()
      expect(profile!.name).toBeTruthy()
      expect(profile!.placeName).toBeTruthy()
      expect(profile!.country).toBeTruthy()
      expect(typeof profile!.lat).toBe('number')
      expect(typeof profile!.lng).toBe('number')
      expect(profile!.email).toContain('@divedispatch.dev')
      expect(profile!.phone).toBeTruthy()
      expect(profile!.verified).toBe(true)
    })

    it('has at least one booking config', () => {
      const slug = diveResortStakeholder!.user.slug
      const configs = BOOKING_CONFIGS.filter((c) => c.ownerSlug === slug)
      expect(configs.length).toBeGreaterThanOrEqual(1)
    })

    it('booking config uses DiveResort ownerType', () => {
      const slug = diveResortStakeholder!.user.slug
      const config = BOOKING_CONFIGS.find((c) => c.ownerSlug === slug)
      expect(config!.ownerType).toBe('DiveResort')
    })
  })

  describe('Agent operator', () => {
    it('exists in ALL_STAKEHOLDERS', () => {
      expect(agentStakeholder).toBeTruthy()
    })

    it('has a user record with all required fields', () => {
      const user = agentStakeholder!.user
      expect(user.slug).toBe('r5yz4q')
      expect(user.email).toContain('@divedispatch.dev')
      expect(user.name).toBeTruthy()
      expect(user.firstName).toBeTruthy()
      expect(user.lastName).toBeTruthy()
      expect(user.businessName).toBeTruthy()
      expect(user.phone).toBeTruthy()
    })

    it('has the Agent role assigned', () => {
      const roles = agentStakeholder!.roles!
      expect(roles).toContainEqual({ role: 'Agent' })
    })

    it('has an agent profile with required fields', () => {
      const profile = agentStakeholder!.agent
      expect(profile).toBeTruthy()
      expect(profile!.name).toBeTruthy()
      expect(profile!.locations.length).toBeGreaterThanOrEqual(1)
      expect(profile!.locations[0].placeName).toBeTruthy()
      expect(profile!.locations[0].country).toBeTruthy()
      expect(typeof profile!.locations[0].lat).toBe('number')
      expect(typeof profile!.locations[0].lng).toBe('number')
      expect(profile!.email).toContain('@divedispatch.dev')
      expect(profile!.phone).toBeTruthy()
      expect(profile!.verified).toBe(true)
    })

    it('has at least one booking config', () => {
      const slug = agentStakeholder!.user.slug
      const configs = BOOKING_CONFIGS.filter((c) => c.ownerSlug === slug)
      expect(configs.length).toBeGreaterThanOrEqual(1)
    })

    it('booking config uses Agent ownerType', () => {
      const slug = agentStakeholder!.user.slug
      const config = BOOKING_CONFIGS.find((c) => c.ownerSlug === slug)
      expect(config!.ownerType).toBe('Agent')
    })

    it('booking config is structurally valid', () => {
      const slug = agentStakeholder!.user.slug
      const config = BOOKING_CONFIGS.find((c) => c.ownerSlug === slug)
      expect(config!.ownerName).toBeTruthy()
      expect(config!.count).toBeGreaterThanOrEqual(1)
      expect(config!.activityMix).toBeTruthy()
      expect(Object.keys(config!.activityMix).length).toBeGreaterThanOrEqual(1)
      expect(config!.statusMix).toBeTruthy()
      expect(Object.keys(config!.statusMix).length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('All stakeholder slugs are unique', () => {
    it('no duplicate slugs', () => {
      const slugs = ALL_STAKEHOLDERS.map((s) => s.user.slug)
      expect(new Set(slugs).size).toBe(slugs.length)
    })
  })

  describe('All stakeholder emails are unique', () => {
    it('no duplicate emails', () => {
      const emails = ALL_STAKEHOLDERS.map((s) => s.user.email)
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
