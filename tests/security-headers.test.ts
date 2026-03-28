import { describe, it, expect } from 'vitest'
import { securityHeaders, HEADER_NAMES } from '../src/lib/security-headers'

describe('security-headers', () => {
  const headerMap = new Map(
    securityHeaders.map((h) => [h.key, h.value])
  )

  describe('required headers are present', () => {
    it('includes Content-Security-Policy', () => {
      expect(headerMap.has('Content-Security-Policy')).toBe(true)
    })

    it('includes X-Frame-Options', () => {
      expect(headerMap.get('X-Frame-Options')).toBe('DENY')
    })

    it('includes X-Content-Type-Options', () => {
      expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff')
    })

    it('includes Strict-Transport-Security', () => {
      const hsts = headerMap.get('Strict-Transport-Security')
      expect(hsts).toBeDefined()
      expect(hsts).toContain('max-age=')
      expect(hsts).toContain('includeSubDomains')
    })

    it('includes Referrer-Policy', () => {
      expect(headerMap.get('Referrer-Policy')).toBe(
        'strict-origin-when-cross-origin'
      )
    })

    it('includes Permissions-Policy', () => {
      const pp = headerMap.get('Permissions-Policy')
      expect(pp).toBeDefined()
      expect(pp).toContain('camera=()')
      expect(pp).toContain('microphone=()')
    })
  })

  describe('CSP directive allowlists', () => {
    const csp = headerMap.get('Content-Security-Policy')!

    it('allows self as default-src', () => {
      expect(csp).toMatch(/default-src\s[^;]*'self'/)
    })

    it('allows Clerk domains in script-src', () => {
      expect(csp).toMatch(/script-src\s[^;]*\*\.clerk\.accounts\.dev/)
      expect(csp).toMatch(/script-src\s[^;]*\*\.clerk\.com/)
    })

    it('allows Convex domains in connect-src', () => {
      expect(csp).toMatch(/connect-src\s[^;]*\*\.convex\.cloud/)
    })

    it('allows Google Maps domains in script-src', () => {
      expect(csp).toMatch(/script-src\s[^;]*maps\.googleapis\.com/)
    })

    it('allows Google Maps static in img-src', () => {
      expect(csp).toMatch(/img-src\s[^;]*maps\.gstatic\.com/)
    })

    it('allows Convex file storage in img-src', () => {
      expect(csp).toMatch(/img-src\s[^;]*\*\.convex\.cloud/)
    })

    it("allows 'unsafe-inline' for style-src (required by Clerk)", () => {
      expect(csp).toMatch(/style-src\s[^;]*'unsafe-inline'/)
    })

    it("allows 'unsafe-inline' for script-src (required by Clerk SDK)", () => {
      expect(csp).toMatch(/script-src\s[^;]*'unsafe-inline'/)
    })
  })

  describe('HEADER_NAMES export', () => {
    it('lists all header keys for documentation', () => {
      expect(HEADER_NAMES).toEqual(
        expect.arrayContaining([
          'Content-Security-Policy',
          'X-Frame-Options',
          'X-Content-Type-Options',
          'Strict-Transport-Security',
          'Referrer-Policy',
          'Permissions-Policy',
        ])
      )
    })
  })

  describe('HSTS max-age is at least 1 year', () => {
    it('has max-age >= 31536000', () => {
      const hsts = headerMap.get('Strict-Transport-Security')!
      const match = hsts.match(/max-age=(\d+)/)
      expect(match).not.toBeNull()
      expect(Number(match![1])).toBeGreaterThanOrEqual(31536000)
    })
  })
})
