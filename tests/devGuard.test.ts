import { describe, it, expect, vi, afterEach } from 'vitest'
import { ConvexError } from 'convex/values'
import { isDevEnvironment, requireDevEnvironment } from '../convex/lib/devGuard'

describe('isDevEnvironment', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns true when ENVIRONMENT is development', () => {
    vi.stubEnv('ENVIRONMENT', 'development')
    expect(isDevEnvironment()).toBe(true)
  })

  it('returns false when ENVIRONMENT is production', () => {
    vi.stubEnv('ENVIRONMENT', 'production')
    expect(isDevEnvironment()).toBe(false)
  })

  it('returns false when ENVIRONMENT is not set', () => {
    vi.stubEnv('ENVIRONMENT', '')
    expect(isDevEnvironment()).toBe(false)
  })
})

describe('requireDevEnvironment', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not throw in development', () => {
    vi.stubEnv('ENVIRONMENT', 'development')
    expect(() => requireDevEnvironment()).not.toThrow()
  })

  it('throws ConvexError in production', () => {
    vi.stubEnv('ENVIRONMENT', 'production')
    expect(() => requireDevEnvironment()).toThrow(ConvexError)
  })

  it('thrown error has FORBIDDEN code', () => {
    vi.stubEnv('ENVIRONMENT', 'production')
    try {
      requireDevEnvironment()
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError)
      expect((err as ConvexError<{ code: string }>).data.code).toBe('FORBIDDEN')
    }
  })

  it('thrown error mentions dev-only', () => {
    vi.stubEnv('ENVIRONMENT', 'production')
    try {
      requireDevEnvironment()
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as ConvexError<{ reason: string }>).data.reason).toContain('Dev-only')
    }
  })
})
