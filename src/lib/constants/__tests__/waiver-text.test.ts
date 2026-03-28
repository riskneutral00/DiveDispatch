import { describe, it, expect } from 'vitest'
import {
  NON_AGENCY_DISCLOSURE,
  LIABILITY_RELEASE_TEXT,
} from '../waiver-text'

describe('waiver legal text constants', () => {
  it('NON_AGENCY_DISCLOSURE contains PADI Member placeholder', () => {
    expect(NON_AGENCY_DISCLOSURE).toContain('____________')
    expect(NON_AGENCY_DISCLOSURE).toContain('PADI')
  })

  it('LIABILITY_RELEASE_TEXT contains liability and assumption of risk language', () => {
    expect(LIABILITY_RELEASE_TEXT).toContain('inherent risks')
    expect(LIABILITY_RELEASE_TEXT).toContain('serious injury or death')
    expect(LIABILITY_RELEASE_TEXT).toContain('_____________')
  })

  it('NON_AGENCY_DISCLOSURE snapshot', () => {
    expect(NON_AGENCY_DISCLOSURE).toMatchSnapshot()
  })

  it('LIABILITY_RELEASE_TEXT snapshot', () => {
    expect(LIABILITY_RELEASE_TEXT).toMatchSnapshot()
  })
})
