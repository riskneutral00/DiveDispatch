import { describe, it, expect } from 'vitest'
import {
  NON_AGENCY_DISCLOSURE,
  LIABILITY_RELEASE_TEXT,
} from '../src/lib/constants/waiver-text'

describe('waiver text constants', () => {
  it('NON_AGENCY_DISCLOSURE is a non-empty string', () => {
    expect(typeof NON_AGENCY_DISCLOSURE).toBe('string')
    expect(NON_AGENCY_DISCLOSURE.length).toBeGreaterThan(0)
  })

  it('LIABILITY_RELEASE_TEXT is a non-empty string', () => {
    expect(typeof LIABILITY_RELEASE_TEXT).toBe('string')
    expect(LIABILITY_RELEASE_TEXT.length).toBeGreaterThan(0)
  })

  it('NON_AGENCY_DISCLOSURE mentions PADI', () => {
    expect(NON_AGENCY_DISCLOSURE).toContain('PADI')
  })

  it('LIABILITY_RELEASE_TEXT mentions SCUBA', () => {
    expect(LIABILITY_RELEASE_TEXT).toContain('SCUBA')
  })

  it('LIABILITY_RELEASE_TEXT mentions inherent risks', () => {
    expect(LIABILITY_RELEASE_TEXT.toLowerCase()).toContain('inherent risks')
  })

  it('NON_AGENCY_DISCLOSURE has placeholder for operator name', () => {
    expect(NON_AGENCY_DISCLOSURE).toContain('____________')
  })

  it('LIABILITY_RELEASE_TEXT has placeholder for operator name', () => {
    expect(LIABILITY_RELEASE_TEXT).toContain('____________')
  })

  it('neither text has leading/trailing whitespace', () => {
    expect(NON_AGENCY_DISCLOSURE).toBe(NON_AGENCY_DISCLOSURE.trim())
    expect(LIABILITY_RELEASE_TEXT).toBe(LIABILITY_RELEASE_TEXT.trim())
  })
})
