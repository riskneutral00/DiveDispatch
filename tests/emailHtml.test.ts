import { describe, it, expect } from 'vitest'
import { buildPortalEmailHtml } from '../convex/email'
import { testDate } from './helpers/dates'

describe('buildPortalEmailHtml', () => {
  const expiryDate = new Date(testDate(20))
  const baseArgs = {
    customerName: 'Jane Doe',
    operatorName: 'Blue Ocean Divers',
    portalUrl: 'https://app.divedispatch.dev/portal/abc-123',
    expiresAt: expiryDate.getTime(),
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
    // The formatted date should contain the year and month from the expiry date
    const expectedYear = String(expiryDate.getFullYear())
    const expectedMonth = expiryDate.toLocaleDateString('en-US', { month: 'long' })
    expect(html).toContain(expectedYear)
    expect(html).toContain(expectedMonth)
  })

  it('is valid HTML with DOCTYPE', () => {
    const html = buildPortalEmailHtml(baseArgs)
    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect(html).toContain('</html>')
  })
})
