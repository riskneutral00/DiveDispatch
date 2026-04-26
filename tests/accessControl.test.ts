import { describe, it, expect } from 'vitest'
import { isResourceAccessible } from '../convex/lib/auth'

describe('isResourceAccessible', () => {
  it('grants access when isAllowed is empty (open access)', () => {
    expect(isResourceAccessible({}, 'any-slug')).toBe(true)
    expect(isResourceAccessible({ isAllowed: [] }, 'any-slug')).toBe(true)
    expect(isResourceAccessible({ isAllowed: undefined }, 'any-slug')).toBe(true)
  })

  it('grants access when requester is on the whitelist', () => {
    expect(isResourceAccessible({ isAllowed: ['dc-a', 'dc-b'] }, 'dc-a')).toBe(true)
  })

  it('denies access when requester is NOT on a non-empty whitelist', () => {
    expect(isResourceAccessible({ isAllowed: ['dc-a', 'dc-b'] }, 'dc-c')).toBe(false)
  })

  it('denies access when requester is on the blacklist', () => {
    expect(isResourceAccessible({ notAllowed: ['bad-actor'] }, 'bad-actor')).toBe(false)
  })

  it('blacklist takes precedence over whitelist', () => {
    expect(
      isResourceAccessible({ isAllowed: ['dc-a'], notAllowed: ['dc-a'] }, 'dc-a'),
    ).toBe(false)
  })

  it('allows non-blacklisted requester even when notAllowed list exists', () => {
    expect(
      isResourceAccessible({ notAllowed: ['bad-actor'] }, 'good-actor'),
    ).toBe(true)
  })
})
