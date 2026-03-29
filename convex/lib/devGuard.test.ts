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

    it.each(['production', '', 'dev'])(
      'returns false when ENVIRONMENT is %j',
      (env) => {
        vi.stubEnv('ENVIRONMENT', env)
        expect(isDevEnvironment()).toBe(false)
      },
    )
  })

  describe('requireDevEnvironment', () => {
    it('does not throw when ENVIRONMENT is development', () => {
      vi.stubEnv('ENVIRONMENT', 'development')
      expect(() => requireDevEnvironment()).not.toThrow()
    })

    it.each(['production', ''])(
      'throws ConvexError FORBIDDEN when ENVIRONMENT is %j',
      (env) => {
        vi.stubEnv('ENVIRONMENT', env)
        try {
          requireDevEnvironment()
          expect.fail('should have thrown')
        } catch (err) {
          expect(err).toBeInstanceOf(ConvexError)
          const convexErr = err as ConvexError<{ code: string; reason: string }>
          expect(convexErr.data.code).toBe(ErrorCode.FORBIDDEN)
        }
      },
    )

    it('includes reason in the error for production', () => {
      vi.stubEnv('ENVIRONMENT', 'production')
      try {
        requireDevEnvironment()
        expect.fail('should have thrown')
      } catch (err) {
        const convexErr = err as ConvexError<{ code: string; reason: string }>
        expect(convexErr.data.reason).toBe('Dev-only endpoint')
      }
    })
  })
})
