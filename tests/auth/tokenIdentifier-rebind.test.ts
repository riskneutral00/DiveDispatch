// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  parseTokenIdentifier,
  isLikelyClerkIssuer,
  isAllowedRebind,
} from '../../convex/lib/tokenIdentifier'

describe('parseTokenIdentifier', () => {
  it('parses well-formed clerk|userId pair', () => {
    expect(parseTokenIdentifier('https://clerk.example.com|user_abc')).toEqual({
      issuer: 'https://clerk.example.com',
      clerkUserId: 'user_abc',
    })
  })

  it('rejects empty string', () => {
    expect(parseTokenIdentifier('')).toBeNull()
  })

  it('rejects missing pipe', () => {
    expect(parseTokenIdentifier('https://clerk.example.com')).toBeNull()
  })

  it('rejects pipe at start', () => {
    expect(parseTokenIdentifier('|user_abc')).toBeNull()
  })

  it('rejects pipe at end (empty userId)', () => {
    expect(parseTokenIdentifier('https://clerk.example.com|')).toBeNull()
  })

  it('handles seed-style tokens (seed|slug)', () => {
    expect(parseTokenIdentifier('seed|matt-lee')).toEqual({
      issuer: 'seed',
      clerkUserId: 'matt-lee',
    })
  })
})

describe('isLikelyClerkIssuer', () => {
  it('true for https Clerk URLs', () => {
    expect(isLikelyClerkIssuer('https://clerk.example.com')).toBe(true)
    expect(isLikelyClerkIssuer('https://novel-something-12.clerk.accounts.dev')).toBe(true)
  })

  it('false for seed test issuer', () => {
    expect(isLikelyClerkIssuer('seed')).toBe(false)
  })

  it('false for clerk literal without https', () => {
    expect(isLikelyClerkIssuer('clerk')).toBe(false)
  })

  it('false for empty string', () => {
    expect(isLikelyClerkIssuer('')).toBe(false)
  })
})

describe('isAllowedRebind', () => {
  it('rebinds same Clerk issuer (matching) to a new userId', () => {
    expect(
      isAllowedRebind(
        'https://clerk.example.com|user_old',
        'https://clerk.example.com|user_new',
      ),
    ).toBe(true)
  })

  it('rejects rebind across different Clerk issuers', () => {
    expect(
      isAllowedRebind(
        'https://clerk.alpha.com|user_a',
        'https://clerk.beta.com|user_b',
      ),
    ).toBe(false)
  })

  it('allows seed → Clerk upgrade (existing is non-Clerk, incoming is Clerk)', () => {
    expect(
      isAllowedRebind('seed|matt-lee', 'https://clerk.example.com|user_clerk'),
    ).toBe(true)
  })

  it('rejects rebind from Clerk to non-Clerk', () => {
    expect(
      isAllowedRebind('https://clerk.example.com|user_a', 'seed|matt-lee'),
    ).toBe(false)
  })

  it('rejects malformed existing token', () => {
    expect(isAllowedRebind('badformat', 'https://clerk.example.com|user_a')).toBe(false)
  })

  it('rejects malformed incoming token', () => {
    expect(isAllowedRebind('https://clerk.example.com|user_a', 'badformat')).toBe(false)
  })

  it('rejects two non-Clerk seed tokens', () => {
    expect(isAllowedRebind('seed|matt', 'seed|other')).toBe(false)
  })
})
