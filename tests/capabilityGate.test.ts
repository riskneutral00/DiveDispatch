import { describe, it, expect } from 'vitest'
import {
  canConductActivity,
  staffCanConductActivity,
  getRank,
  type Credential,
} from '../convex/shared/capabilityGate'
import { Rank } from '../convex/shared/activityCatalog'

describe('getRank', () => {
  it('returns DM rank for PADI Divemaster', () => {
    expect(getRank({ agency: 'PADI', level: 'Divemaster' })).toBe(Rank.DM)
  })

  it('returns Instructor rank for PADI OWSI', () => {
    expect(getRank({ agency: 'PADI', level: 'OWSI' })).toBe(Rank.Instructor)
  })

  it('returns Instructor rank for PADI MSDT (title, same rank as OWSI)', () => {
    expect(getRank({ agency: 'PADI', level: 'MSDT' })).toBe(Rank.Instructor)
  })

  it('returns Staff rank for PADI IDC Staff Instructor', () => {
    expect(getRank({ agency: 'PADI', level: 'IDC Staff Instructor' })).toBe(Rank.Staff)
  })

  it('returns Director rank for PADI Course Director', () => {
    expect(getRank({ agency: 'PADI', level: 'Course Director' })).toBe(Rank.Director)
  })

  it('returns DM rank for SSI Dive Guide', () => {
    expect(getRank({ agency: 'SSI', level: 'Dive Guide' })).toBe(Rank.DM)
  })

  it('returns Instructor rank for SSI OWI', () => {
    expect(getRank({ agency: 'SSI', level: 'OWI' })).toBe(Rank.Instructor)
  })

  it('returns null for unknown agency', () => {
    expect(getRank({ agency: 'CMAS', level: '1-Star' })).toBeNull()
  })

  it('returns null for unknown level', () => {
    expect(getRank({ agency: 'PADI', level: 'Master Instructor' })).toBeNull()
  })
})

describe('canConductActivity — rank gate', () => {
  const padiDM: Credential = { agency: 'PADI', level: 'Divemaster' }
  const padiOWSI: Credential = { agency: 'PADI', level: 'OWSI', specialtyRatings: [] }
  const padiMSDT: Credential = { agency: 'PADI', level: 'MSDT', specialtyRatings: ['Deep', 'Wreck', 'Navigation', 'Night', 'Enriched Air'] }
  const ssiDG: Credential = { agency: 'SSI', level: 'Dive Guide' }
  const ssiOWI: Credential = { agency: 'SSI', level: 'OWI', specialtyRatings: [] }

  it('DM can conduct FD', () => {
    expect(canConductActivity(padiDM, 'FD').allowed).toBe(true)
  })

  it('DM can conduct DSD (trojan horse)', () => {
    expect(canConductActivity(padiDM, 'DSD').allowed).toBe(true)
  })

  it('DM can conduct TRY_DIVE (trojan horse)', () => {
    expect(canConductActivity(padiDM, 'TRY_DIVE').allowed).toBe(true)
  })

  it('DM cannot conduct OW', () => {
    const result = canConductActivity(padiDM, 'OW')
    expect(result.allowed).toBe(false)
    expect(result.reason?.kind).toBe('rank')
  })

  it('DM cannot conduct AOW', () => {
    expect(canConductActivity(padiDM, 'AOW').allowed).toBe(false)
  })

  it('DM cannot conduct RESCUE', () => {
    expect(canConductActivity(padiDM, 'RESCUE').allowed).toBe(false)
  })

  it('DM cannot conduct DM course', () => {
    expect(canConductActivity(padiDM, 'DM').allowed).toBe(false)
  })

  it('DM cannot conduct REFRESH', () => {
    expect(canConductActivity(padiDM, 'REFRESH').allowed).toBe(false)
  })

  it('DM cannot conduct SPECIALTY', () => {
    expect(canConductActivity(padiDM, 'SPECIALTY').allowed).toBe(false)
  })

  it('OWSI can conduct all activities', () => {
    for (const code of ['FD', 'DSD', 'TRY_DIVE', 'OW', 'AOW', 'RESCUE', 'DM', 'REFRESH', 'SPECIALTY'] as const) {
      expect(canConductActivity(padiOWSI, code).allowed, `OWSI should pass for ${code}`).toBe(true)
    }
  })

  it('MSDT has same permissions as OWSI (title, not tier)', () => {
    for (const code of ['FD', 'DSD', 'TRY_DIVE', 'OW', 'AOW', 'RESCUE', 'DM', 'REFRESH', 'SPECIALTY'] as const) {
      expect(canConductActivity(padiMSDT, code).allowed, `MSDT should pass for ${code}`).toBe(true)
    }
  })

  it('SSI Dive Guide mirrors PADI DM permissions', () => {
    expect(canConductActivity(ssiDG, 'FD').allowed).toBe(true)
    expect(canConductActivity(ssiDG, 'DSD').allowed).toBe(true)
    expect(canConductActivity(ssiDG, 'OW').allowed).toBe(false)
  })

  it('SSI OWI can conduct all activities', () => {
    for (const code of ['FD', 'DSD', 'OW', 'AOW', 'RESCUE', 'DM', 'REFRESH', 'SPECIALTY'] as const) {
      expect(canConductActivity(ssiOWI, code).allowed, `OWI should pass for ${code}`).toBe(true)
    }
  })

  it('unknown agency passes gracefully (gate only blocks known agencies)', () => {
    const result = canConductActivity({ agency: 'CMAS', level: '1-Star' }, 'FD')
    expect(result.allowed).toBe(true)
  })

  it('unknown level fails with rank reason', () => {
    const result = canConductActivity({ agency: 'PADI', level: 'Master Instructor' }, 'FD')
    expect(result.allowed).toBe(false)
    expect(result.reason?.kind).toBe('rank')
    expect(result.reason?.detail).toContain('Unknown level')
  })
})

describe('canConductActivity — specialty rating gate', () => {
  it('SPECIALTY passes without specialty code (v1 catch-all)', () => {
    const cred: Credential = { agency: 'PADI', level: 'OWSI', specialtyRatings: [] }
    expect(canConductActivity(cred, 'SPECIALTY').allowed).toBe(true)
  })

  it('SPECIALTY with specialty code and matching rating passes', () => {
    const cred: Credential = { agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep'] }
    expect(canConductActivity(cred, 'SPECIALTY', 'Deep').allowed).toBe(true)
  })

  it('SPECIALTY with specialty code and missing rating fails', () => {
    const cred: Credential = { agency: 'PADI', level: 'OWSI', specialtyRatings: [] }
    const result = canConductActivity(cred, 'SPECIALTY', 'Deep')
    expect(result.allowed).toBe(false)
    expect(result.reason?.kind).toBe('rating')
    expect(result.reason?.detail).toContain('Deep')
  })

  it('PPB passes without rating (automatic authority)', () => {
    const cred: Credential = { agency: 'PADI', level: 'OWSI', specialtyRatings: [] }
    expect(canConductActivity(cred, 'SPECIALTY', 'PPB').allowed).toBe(true)
  })

  it('Shark/Turtle passes without rating (automatic authority)', () => {
    const cred: Credential = { agency: 'PADI', level: 'OWSI', specialtyRatings: [] }
    expect(canConductActivity(cred, 'SPECIALTY', 'Shark/Turtle').allowed).toBe(true)
  })
})

describe('staffCanConductActivity — multi-credential', () => {
  it('passes if any credential allows', () => {
    const credentials: Credential[] = [
      { agency: 'PADI', level: 'Divemaster' },
      { agency: 'SSI', level: 'OWI', specialtyRatings: [] },
    ]
    expect(staffCanConductActivity(credentials, 'OW').allowed).toBe(true)
  })

  it('fails if no credential allows', () => {
    const credentials: Credential[] = [
      { agency: 'PADI', level: 'Divemaster' },
      { agency: 'SSI', level: 'Dive Guide' },
    ]
    const result = staffCanConductActivity(credentials, 'OW')
    expect(result.allowed).toBe(false)
    expect(result.reason?.kind).toBe('rank')
  })

  it('returns last failure reason for diagnostics', () => {
    const credentials: Credential[] = [
      { agency: 'PADI', level: 'Divemaster' },
    ]
    const result = staffCanConductActivity(credentials, 'OW')
    expect(result.reason?.detail).toContain('Divemaster')
  })

  it('empty credentials fail', () => {
    expect(staffCanConductActivity([], 'FD').allowed).toBe(false)
  })

  it('SPECIALTY with Deep passes when one credential has Deep rating', () => {
    const credentials: Credential[] = [
      { agency: 'PADI', level: 'Divemaster' },
      { agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep'] },
    ]
    expect(staffCanConductActivity(credentials, 'SPECIALTY', 'Deep').allowed).toBe(true)
  })

  it('SPECIALTY with Wreck fails when no credential has Wreck rating', () => {
    const credentials: Credential[] = [
      { agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep', 'Navigation'] },
    ]
    const result = staffCanConductActivity(credentials, 'SPECIALTY', 'Wreck')
    expect(result.allowed).toBe(false)
    expect(result.reason?.kind).toBe('rating')
  })

  it('cross-agency credentials: PADI Deep + SSI Wreck both pass', () => {
    const credentials: Credential[] = [
      { agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep'] },
      { agency: 'SSI', level: 'OWI', specialtyRatings: ['Wreck'] },
    ]
    expect(staffCanConductActivity(credentials, 'SPECIALTY', 'Deep').allowed).toBe(true)
    expect(staffCanConductActivity(credentials, 'SPECIALTY', 'Wreck').allowed).toBe(true)
  })
})
