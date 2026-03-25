import { describe, it, expect } from 'vitest'
import { buildPortalEmailHtml } from '../convex/email'

describe('buildPortalEmailHtml', () => {
  const baseArgs = {
    customerName: 'Jane Doe',
    operatorName: 'Blue Ocean Divers',
    portalUrl: 'https://app.divedispatch.dev/portal/abc-123',
    expiresAt: new Date('2026-04-15').getTime(),
  }

  it('includes customer name', () => {
    const html = buildPortalEmailHtml(baseArgs)
    expect(html).toContain('Hi Jane Doe,')
  })

  it('includes operator name', () => {
    const html = buildPortalEmailHtml(baseArgs)
    expect(html).toContain('Blue Ocean Divers')
  })

  it('includes portal URL as link', () => {
    const html = buildPortalEmailHtml(baseArgs)
    expect(html).toContain('href="https://app.divedispatch.dev/portal/abc-123"')
  })

  it('includes formatted expiry date', () => {
    const html = buildPortalEmailHtml(baseArgs)
    // The formatted date should contain April and 2026
    expect(html).toContain('2026')
    expect(html).toContain('April')
  })

  it('is valid HTML with DOCTYPE', () => {
    const html = buildPortalEmailHtml(baseArgs)
    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect(html).toContain('</html>')
  })
})
