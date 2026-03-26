import { describe, it, expect, vi, afterEach } from 'vitest'
import { ConvexError } from 'convex/values'
import { isDevEnvironment, requireDevEnvironment } from './devGuard'
import { ErrorCode } from './errorCodes'

describe('devGuard', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('isDevEnvironment', () => {
    it('returns true when ENVIRONMENT is development', () => {
      vi.stubEnv('ENVIRONMENT', 'development')
      expect(isDevEnvironment()).toBe(true)
    })

    it('returns false when ENVIRONMENT is production', () => {
      vi.stubEnv('ENVIRONMENT', 'production')
      expect(isDevEnvironment()).toBe(false)
    })

    it('returns false when ENVIRONMENT is undefined', () => {
      vi.stubEnv('ENVIRONMENT', '')
      expect(isDevEnvironment()).toBe(false)
    })

    it('returns false for near-miss values', () => {
      vi.stubEnv('ENVIRONMENT', 'dev')
      expect(isDevEnvironment()).toBe(false)
    })
  })

  describe('requireDevEnvironment', () => {
    it('does not throw when ENVIRONMENT is development', () => {
      vi.stubEnv('ENVIRONMENT', 'development')
      expect(() => requireDevEnvironment()).not.toThrow()
    })

    it('throws ConvexError FORBIDDEN when ENVIRONMENT is production', () => {
      vi.stubEnv('ENVIRONMENT', 'production')
      try {
        requireDevEnvironment()
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ConvexError)
        const convexErr = err as ConvexError<{ code: string; reason: string }>
        expect(convexErr.data.code).toBe(ErrorCode.FORBIDDEN)
        expect(convexErr.data.reason).toBe('Dev-only endpoint')
      }
    })

    it('throws ConvexError FORBIDDEN when ENVIRONMENT is undefined', () => {
      vi.stubEnv('ENVIRONMENT', '')
      try {
        requireDevEnvironment()
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ConvexError)
        const convexErr = err as ConvexError<{ code: string; reason: string }>
        expect(convexErr.data.code).toBe(ErrorCode.FORBIDDEN)
      }
    })
  })
})
