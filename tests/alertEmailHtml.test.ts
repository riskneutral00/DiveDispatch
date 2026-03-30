import { describe, it, expect } from 'vitest'
import { buildAlertEmailHtml } from '../convex/lib/alerts'

describe('buildAlertEmailHtml', () => {
  it('produces valid HTML', () => {
    const html = buildAlertEmailHtml({ jobName: 'test-job', error: 'Something broke' })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</html>')
  })

  it('includes job name', () => {
    const html = buildAlertEmailHtml({ jobName: 'expiry-check', error: 'timeout' })
    expect(html).toContain('expiry-check')
  })

  it('includes error message', () => {
    const html = buildAlertEmailHtml({ jobName: 'cron', error: 'Connection refused' })
    expect(html).toContain('Connection refused')
  })

  it('includes DiveDispatch branding', () => {
    const html = buildAlertEmailHtml({ jobName: 'x', error: 'y' })
    expect(html).toContain('DiveDispatch')
  })

  it('includes timestamp', () => {
    const html = buildAlertEmailHtml({ jobName: 'x', error: 'y' })
    expect(html).toContain('Timestamp:')
  })

  it('includes Cron Job Failure heading', () => {
    const html = buildAlertEmailHtml({ jobName: 'x', error: 'y' })
    expect(html).toContain('Cron Job Failure')
  })
})
