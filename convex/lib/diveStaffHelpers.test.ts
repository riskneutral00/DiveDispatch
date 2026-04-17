import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import {
  hasInstructorLevelCredential,
  hasDivemasterLevelCredential,
  getHighestCredentialClass,
  assertNitroxCapable,
} from './diveStaffHelpers'
import type { Credential } from '../shared/capabilityGate'

const DM: Credential = { agency: 'PADI', level: 'DM' }
const AI: Credential = { agency: 'PADI', level: 'AI' }
const OWSI: Credential = { agency: 'PADI', level: 'OWSI' }
const MSDT: Credential = { agency: 'PADI', level: 'MSDT' }
const CD: Credential = { agency: 'PADI', level: 'CD' }
const SSI_DIVE_GUIDE: Credential = { agency: 'SSI', level: 'Dive Guide' }
const SSI_OWI: Credential = { agency: 'SSI', level: 'OWI' }
const UNKNOWN_AGENCY: Credential = { agency: 'ACME', level: 'BlackBelt' }

describe('hasInstructorLevelCredential', () => {
  it('true when any credential is instructor-rated (PADI OWSI)', () => {
    expect(hasInstructorLevelCredential([OWSI])).toBe(true)
  })

  it('true for MSDT, CD (all PADI instructor levels)', () => {
    expect(hasInstructorLevelCredential([MSDT])).toBe(true)
    expect(hasInstructorLevelCredential([CD])).toBe(true)
  })

  it('true for SSI OWI (instructor-level)', () => {
    expect(hasInstructorLevelCredential([SSI_OWI])).toBe(true)
  })

  it('false for PADI DM only', () => {
    expect(hasInstructorLevelCredential([DM])).toBe(false)
  })

  it('false for PADI AI (assistant instructor — not full instructor)', () => {
    expect(hasInstructorLevelCredential([AI])).toBe(false)
  })

  it('false for SSI Dive Guide only', () => {
    expect(hasInstructorLevelCredential([SSI_DIVE_GUIDE])).toBe(false)
  })

  it('true when at least one of many credentials is instructor-level', () => {
    expect(hasInstructorLevelCredential([DM, OWSI])).toBe(true)
  })

  it('false on empty array', () => {
    expect(hasInstructorLevelCredential([])).toBe(false)
  })

  it('false on undefined', () => {
    expect(hasInstructorLevelCredential(undefined)).toBe(false)
  })

  it('false for unknown agency', () => {
    expect(hasInstructorLevelCredential([UNKNOWN_AGENCY])).toBe(false)
  })
})

describe('hasDivemasterLevelCredential', () => {
  it('true for PADI DM', () => {
    expect(hasDivemasterLevelCredential([DM])).toBe(true)
  })

  it('true for PADI AI (non-instructor level)', () => {
    expect(hasDivemasterLevelCredential([AI])).toBe(true)
  })

  it('true for SSI Dive Guide', () => {
    expect(hasDivemasterLevelCredential([SSI_DIVE_GUIDE])).toBe(true)
  })

  it('true for instructor-level credentials (superset semantics)', () => {
    expect(hasDivemasterLevelCredential([OWSI])).toBe(true)
    expect(hasDivemasterLevelCredential([SSI_OWI])).toBe(true)
  })

  it('false on empty / undefined', () => {
    expect(hasDivemasterLevelCredential([])).toBe(false)
    expect(hasDivemasterLevelCredential(undefined)).toBe(false)
  })

  it('false for unknown agency', () => {
    expect(hasDivemasterLevelCredential([UNKNOWN_AGENCY])).toBe(false)
  })
})

describe('getHighestCredentialClass', () => {
  it('returns "instructor" when any credential is instructor-level', () => {
    expect(getHighestCredentialClass([OWSI])).toBe('instructor')
    expect(getHighestCredentialClass([DM, OWSI])).toBe('instructor')
  })

  it('returns "divemaster" when highest is DM-level', () => {
    expect(getHighestCredentialClass([DM])).toBe('divemaster')
    expect(getHighestCredentialClass([AI])).toBe('divemaster')
    expect(getHighestCredentialClass([SSI_DIVE_GUIDE])).toBe('divemaster')
  })

  it('returns null on empty or all-unknown', () => {
    expect(getHighestCredentialClass([])).toBeNull()
    expect(getHighestCredentialClass(undefined)).toBeNull()
    expect(getHighestCredentialClass([UNKNOWN_AGENCY])).toBeNull()
  })
})

describe('assertNitroxCapable', () => {
  it('no-op when booking does not need nitrox', () => {
    expect(() => assertNitroxCapable({ nitroxCertified: false }, false)).not.toThrow()
    expect(() => assertNitroxCapable({ nitroxCertified: undefined }, false)).not.toThrow()
    expect(() => assertNitroxCapable(null, false)).not.toThrow()
  })

  it('no-op when staff is null (no gate to apply)', () => {
    expect(() => assertNitroxCapable(null, true)).not.toThrow()
  })

  it('passes when booking needs nitrox and staff is certified', () => {
    expect(() => assertNitroxCapable({ nitroxCertified: true }, true)).not.toThrow()
  })

  it('throws CAPABILITY_GAP when booking needs nitrox and staff has nitroxCertified=false', () => {
    expect(() => assertNitroxCapable({ nitroxCertified: false, name: 'Ryan' }, true)).toThrow(ConvexError)
    try {
      assertNitroxCapable({ nitroxCertified: false, name: 'Ryan' }, true)
    } catch (e) {
      expect(e).toBeInstanceOf(ConvexError)
      const data = (e as ConvexError<{ code: string; reason: string; staffName: string | null }>).data
      expect(data.code).toBe('CAPABILITY_GAP')
      expect(data.reason).toBe('nitroxRequired')
      expect(data.staffName).toBe('Ryan')
    }
  })

  it('throws when nitroxCertified is undefined (fail-safe default)', () => {
    expect(() => assertNitroxCapable({ nitroxCertified: undefined }, true)).toThrow(ConvexError)
  })
})
