import { describe, it, expect } from 'vitest'
import en from '../../../../messages/en.json'

describe('nav.roles key present in en.json', () => {
  it('en has nav.roles', () => {
    expect(typeof en.nav.roles).toBe('string')
    expect(en.nav.roles.length).toBeGreaterThan(0)
  })

  it('en nav.roles is "Roles"', () => {
    expect(en.nav.roles).toBe('Roles')
  })
})
