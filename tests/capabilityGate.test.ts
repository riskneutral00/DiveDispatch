import { describe, it, expect } from 'vitest'
import {
  canConductActivity,
  staffCanConductActivity,
  getIsInstructor,
  type Credential,
} from '../convex/shared/capabilityGate'

describe('getIsInstructor', () => {
  it('returns false for PADI DM', () => {
    expect(getIsInstructor({ agency: 'PADI', level: 'DM' })).toBe(false)
  })

  it('returns false for PADI AI (cannot teach independently)', () => {
    expect(getIsInstructor({ agency: 'PADI', level: 'AI' })).toBe(false)
  })

  it('returns true for PADI OWSI', () => {
    expect(getIsInstructor({ agency: 'PADI', level: 'OWSI' })).toBe(true)
  })

  it('returns true for PADI MSDT', () => {
    expect(getIsInstructor({ agency: 'PADI', level: 'MSDT' })).toBe(true)
  })

  it('returns true for PADI IDCS', () => {
    expect(getIsInstructor({ agency: 'PADI', level: 'IDCS' })).toBe(true)
  })

  it('returns true for PADI MI', () => {
    expect(getIsInstructor({ agency: 'PADI', level: 'MI' })).toBe(true)
  })

  it('returns true for PADI CD', () => {
    expect(getIsInstructor({ agency: 'PADI', level: 'CD' })).toBe(true)
  })

  it('returns false for SSI Dive Guide', () => {
    expect(getIsInstructor({ agency: 'SSI', level: 'Dive Guide' })).toBe(false)
  })

  it('returns true for SSI OWI', () => {
    expect(getIsInstructor({ agency: 'SSI', level: 'OWI' })).toBe(true)
  })

  it('returns null for unknown agency', () => {
    expect(getIsInstructor({ agency: 'UNKNOWN', level: 'Something' })).toBeNull()
  })

  it('returns null for unknown level', () => {
    expect(getIsInstructor({ agency: 'PADI', level: 'Master Instructor' })).toBeNull()
  })
})

describe('canConductActivity — rank gate', () => {
  const padiDM: Credential = { agency: 'PADI', level: 'DM' }
  const padiOWSI: Credential = { agency: 'PADI', level: 'OWSI', specialtyRatings: [] }
  const padiMSDT: Credential = { agency: 'PADI', level: 'MSDT', specialtyRatings: ['Deep', 'Wreck', 'Navigation', 'Night', 'Enriched Air'] }
  const ssiDG: Credential = { agency: 'SSI', level: 'Dive Guide' }
  const ssiOWI: Credential = { agency: 'SSI', level: 'OWI', specialtyRatings: [] }

  it('DM can conduct FD', () => {
    expect(canConductActivity(padiDM, 'FD').allowed).toBe(true)
  })

  it('DM can conduct DSD', () => {
    expect(canConductActivity(padiDM, 'DSD').allowed).toBe(true)
  })

  it('DM can conduct TRY_DIVE', () => {
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

  it('NAUI Divemaster cannot conduct OW', () => {
    const cred: Credential = { agency: 'NAUI', level: 'Divemaster' }
    expect(canConductActivity(cred, 'OW').allowed).toBe(false)
  })

  it('NAUI Instructor can conduct OW', () => {
    const cred: Credential = { agency: 'NAUI', level: 'Instructor', specialtyRatings: [] }
    expect(canConductActivity(cred, 'OW').allowed).toBe(true)
  })

  it('BSAC Dive Leader cannot conduct OW', () => {
    const cred: Credential = { agency: 'BSAC', level: 'Dive Leader' }
    expect(canConductActivity(cred, 'OW').allowed).toBe(false)
  })

  it('BSAC Open Water Instructor can conduct OW', () => {
    const cred: Credential = { agency: 'BSAC', level: 'Open Water Instructor', specialtyRatings: [] }
    expect(canConductActivity(cred, 'OW').allowed).toBe(true)
  })

  it('CMAS Divemaster cannot conduct OW', () => {
    const cred: Credential = { agency: 'CMAS', level: 'Divemaster' }
    expect(canConductActivity(cred, 'OW').allowed).toBe(false)
  })

  it('CMAS One Star Instructor can conduct OW', () => {
    const cred: Credential = { agency: 'CMAS', level: 'One Star Instructor', specialtyRatings: [] }
    expect(canConductActivity(cred, 'OW').allowed).toBe(true)
  })

  it('unknown agency passes gracefully (gate only blocks known agencies)', () => {
    const result = canConductActivity({ agency: 'UNKNOWN', level: 'Something' }, 'FD')
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
      { agency: 'PADI', level: 'DM' },
      { agency: 'SSI', level: 'OWI', specialtyRatings: [] },
    ]
    expect(staffCanConductActivity(credentials, 'OW').allowed).toBe(true)
  })

  it('fails if no credential allows', () => {
    const credentials: Credential[] = [
      { agency: 'PADI', level: 'DM' },
      { agency: 'SSI', level: 'Dive Guide' },
    ]
    const result = staffCanConductActivity(credentials, 'OW')
    expect(result.allowed).toBe(false)
    expect(result.reason?.kind).toBe('rank')
  })

  it('returns last failure reason for diagnostics', () => {
    const credentials: Credential[] = [
      { agency: 'PADI', level: 'DM' },
    ]
    const result = staffCanConductActivity(credentials, 'OW')
    expect(result.reason?.detail).toContain('DM')
  })

  it('empty credentials fail', () => {
    expect(staffCanConductActivity([], 'FD').allowed).toBe(false)
  })

  it('SPECIALTY with Deep passes when one credential has Deep rating', () => {
    const credentials: Credential[] = [
      { agency: 'PADI', level: 'DM' },
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
