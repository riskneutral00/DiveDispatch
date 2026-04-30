import { describe, it, expect } from 'vitest'
import {
  getSignupResourceTiles,
  collapseSignupTilesToRoles,
  deriveVenueSignupIntent,
  type SignupRoleTileConfig,
} from '../signup-role-tiles'
import { VENUE_KINDS } from '../../../../convex/shared/venueTypes'

const tiles = getSignupResourceTiles()
const tileByKey = (k: string) =>
  tiles.find((t) => t.tileKey === k) as SignupRoleTileConfig

describe('getSignupResourceTiles', () => {
  it('returns 6 resource display tiles (4 non-venue + 2 venue kinds)', () => {
    expect(tiles).toHaveLength(6)
  })

  it('includes Pool and Dive Site tiles with kind hints', () => {
    const pool = tileByKey('pool')
    const diveSite = tileByKey('dive-site')
    expect(pool).toBeDefined()
    expect(diveSite).toBeDefined()
    expect(pool.clerkRole).toBe('Venue')
    expect(diveSite.clerkRole).toBe('Venue')
    expect(pool.venueKindHint).toBe('pool')
    expect(diveSite.venueKindHint).toBe('dive_site')
    expect(pool.label).toBe('Pool')
    expect(diveSite.label).toBe('Dive Site')
  })

  it('does not include a generic "Venue" tile', () => {
    const venueTile = tiles.find(
      (t) => t.label === 'Venue' && !t.venueKindHint,
    )
    expect(venueTile).toBeUndefined()
  })

  it('non-venue resource tiles preserve their canonical role keys', () => {
    const expected = ['instructor', 'boat', 'equipment', 'compressor']
    for (const k of expected) {
      const t = tileByKey(k)
      expect(t, `${k} tile present`).toBeDefined()
      expect(t.venueKindHint).toBeUndefined()
    }
  })

  it('exhaustive coverage: every VENUE_KINDS member produces exactly one tile', () => {
    for (const kind of VENUE_KINDS) {
      const matches = tiles.filter((t) => t.venueKindHint === kind)
      expect(matches, `${kind} should have one tile`).toHaveLength(1)
    }
  })
})

describe('collapseSignupTilesToRoles', () => {
  it('Pool + Dive Site collapses to one Venue role', () => {
    const out = collapseSignupTilesToRoles([
      tileByKey('pool'),
      tileByKey('dive-site'),
    ])
    expect(out).toEqual(['Venue'])
  })

  it('Pool only -> [Venue]', () => {
    expect(collapseSignupTilesToRoles([tileByKey('pool')])).toEqual(['Venue'])
  })

  it('Dive Site only -> [Venue]', () => {
    expect(collapseSignupTilesToRoles([tileByKey('dive-site')])).toEqual(['Venue'])
  })

  it('mixed Pool + Boat -> [Venue, Boat] preserving order, deduped', () => {
    const out = collapseSignupTilesToRoles([
      tileByKey('pool'),
      tileByKey('boat'),
    ])
    expect(out).toEqual(['Venue', 'Boat'])
  })

  it('empty input -> []', () => {
    expect(collapseSignupTilesToRoles([])).toEqual([])
  })
})

describe('deriveVenueSignupIntent', () => {
  it('Pool only -> "pool"', () => {
    expect(deriveVenueSignupIntent([tileByKey('pool')])).toBe('pool')
  })

  it('Dive Site only -> "dive_site"', () => {
    expect(deriveVenueSignupIntent([tileByKey('dive-site')])).toBe('dive_site')
  })

  it('both -> "multi"', () => {
    expect(
      deriveVenueSignupIntent([tileByKey('pool'), tileByKey('dive-site')]),
    ).toBe('multi')
  })

  it('no venue tile -> null', () => {
    expect(deriveVenueSignupIntent([tileByKey('boat')])).toBe(null)
  })

  it('empty -> null', () => {
    expect(deriveVenueSignupIntent([])).toBe(null)
  })
})

