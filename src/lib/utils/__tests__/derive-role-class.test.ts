import { describe, it, expect } from 'vitest'
import { deriveRoleClass } from '../role'
import type { ClerkRole } from '@/lib/constants/roles'

describe('deriveRoleClass', () => {
  it('returns business for DiveCenter', () => {
    expect(deriveRoleClass(['DiveCenter'])).toBe('business')
  })

  it('returns business for Liveaboard', () => {
    expect(deriveRoleClass(['Liveaboard'])).toBe('business')
  })

  it('returns business for DiveResort', () => {
    expect(deriveRoleClass(['DiveResort'])).toBe('business')
  })

  it('returns business for DiveHostel', () => {
    expect(deriveRoleClass(['DiveHostel'])).toBe('business')
  })

  it('returns freelance for Agent (solo agency)', () => {
    expect(deriveRoleClass(['Agent'])).toBe('freelance')
  })

  it('returns freelance for DiveSite', () => {
    expect(deriveRoleClass(['DiveSite'])).toBe('freelance')
  })

  it('returns freelance for Instructor', () => {
    expect(deriveRoleClass(['Instructor'])).toBe('freelance')
  })

  it('returns freelance for Boat', () => {
    expect(deriveRoleClass(['Boat'])).toBe('freelance')
  })

  it('returns freelance for Equipment', () => {
    expect(deriveRoleClass(['Equipment'])).toBe('freelance')
  })

  it('returns freelance for Pool', () => {
    expect(deriveRoleClass(['Pool'])).toBe('freelance')
  })

  it('returns freelance for Compressor', () => {
    expect(deriveRoleClass(['Compressor'])).toBe('freelance')
  })

  it('returns business when any selected role is business (Somchai: DC + Pool + Boat)', () => {
    const roles: ClerkRole[] = ['DiveCenter', 'Pool', 'Boat']
    expect(deriveRoleClass(roles)).toBe('business')
  })

  it('returns business when business role is last in the array', () => {
    const roles: ClerkRole[] = ['Instructor', 'Boat', 'Liveaboard']
    expect(deriveRoleClass(roles)).toBe('business')
  })

  it('returns freelance when all selected roles are freelance', () => {
    const roles: ClerkRole[] = ['Instructor', 'Boat', 'Equipment']
    expect(deriveRoleClass(roles)).toBe('freelance')
  })

  it('throws when selectedRoles is empty', () => {
    expect(() => deriveRoleClass([])).toThrow()
  })
})
