import { describe, it, expect, vi, afterEach } from 'vitest'
import { ConvexError } from 'convex/values'
import {
  isDevEnvironment,
  requireDevEnvironment,
  isDevSwitchEnabled,
  requireDevSwitchEnabled,
} from './devGuard'
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

  describe('isDevSwitchEnabled', () => {
    it('returns true only when ENVIRONMENT=development AND ALLOW_DEV_SWITCH=true', () => {
      vi.stubEnv('ENVIRONMENT', 'development')
      vi.stubEnv('ALLOW_DEV_SWITCH', 'true')
      expect(isDevSwitchEnabled()).toBe(true)
    })

    it('returns false when ENVIRONMENT=development but ALLOW_DEV_SWITCH is unset', () => {
      vi.stubEnv('ENVIRONMENT', 'development')
      vi.stubEnv('ALLOW_DEV_SWITCH', '')
      expect(isDevSwitchEnabled()).toBe(false)
    })

    it('returns false when ALLOW_DEV_SWITCH=true but ENVIRONMENT is production', () => {
      vi.stubEnv('ENVIRONMENT', 'production')
      vi.stubEnv('ALLOW_DEV_SWITCH', 'true')
      expect(isDevSwitchEnabled()).toBe(false)
    })

    it.each(['1', 'yes', 'TRUE', 'True'])(
      'returns false when ALLOW_DEV_SWITCH is %j (strict literal "true" only)',
      (val) => {
        vi.stubEnv('ENVIRONMENT', 'development')
        vi.stubEnv('ALLOW_DEV_SWITCH', val)
        expect(isDevSwitchEnabled()).toBe(false)
      },
    )
  })

  describe('requireDevSwitchEnabled', () => {
    it('does not throw when both env vars are set correctly', () => {
      vi.stubEnv('ENVIRONMENT', 'development')
      vi.stubEnv('ALLOW_DEV_SWITCH', 'true')
      expect(() => requireDevSwitchEnabled()).not.toThrow()
    })

    it('throws FORBIDDEN when ALLOW_DEV_SWITCH is missing even in development', () => {
      vi.stubEnv('ENVIRONMENT', 'development')
      vi.stubEnv('ALLOW_DEV_SWITCH', '')
      try {
        requireDevSwitchEnabled()
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ConvexError)
        const convexErr = err as ConvexError<{ code: string; reason: string }>
        expect(convexErr.data.code).toBe(ErrorCode.FORBIDDEN)
        expect(convexErr.data.reason).toBe('Dev switcher disabled')
      }
    })

    it('throws FORBIDDEN in production regardless of ALLOW_DEV_SWITCH', () => {
      vi.stubEnv('ENVIRONMENT', 'production')
      vi.stubEnv('ALLOW_DEV_SWITCH', 'true')
      expect(() => requireDevSwitchEnabled()).toThrow(ConvexError)
    })
  })
})
