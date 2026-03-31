import { describe, it, expect } from 'vitest'
import { securityHeaders } from '../src/lib/security-headers'

describe('security-headers', () => {
  const headerMap = new Map(
    securityHeaders.map((h) => [h.key, h.value])
  )

  describe('required headers are present', () => {
    it('includes X-Frame-Options', () => {
      expect(headerMap.get('X-Frame-Options')).toBe('DENY')
    })

    it('includes X-Content-Type-Options', () => {
      expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff')
    })

    it('includes Strict-Transport-Security', () => {
      const hsts = headerMap.get('Strict-Transport-Security')
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

    it('allows Convex domains in connect-src (HTTPS and WSS)', () => {
      expect(csp).toMatch(/connect-src\s[^;]*\*\.convex\.cloud/)
      expect(csp).toMatch(/connect-src\s[^;]*wss:\/\/\*\.convex\.cloud/)
    })

    it('allows blob: workers in worker-src (required by Convex client)', () => {
      expect(csp).toMatch(/worker-src\s[^;]*blob:/)
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

  describe('HSTS max-age is at least 1 year', () => {
    it('has max-age >= 31536000', () => {
      const hsts = headerMap.get('Strict-Transport-Security')!
      const match = hsts.match(/max-age=(\d+)/)
      expect(match).not.toBeNull()
      expect(Number(match![1])).toBeGreaterThanOrEqual(31536000)
    })
  })
})
