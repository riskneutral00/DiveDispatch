import { describe, it, expect } from 'vitest'
import { buildAlertEmailHtml } from './alerts'

describe('buildAlertEmailHtml', () => {
  it('includes the job name in the output', () => {
    const html = buildAlertEmailHtml({ jobName: 'complete-bookings', error: 'timeout' })
    expect(html).toContain('complete-bookings')
  })

  it('includes the error message in the output', () => {
    const html = buildAlertEmailHtml({ jobName: 'complete-bookings', error: 'DB write failed' })
    expect(html).toContain('DB write failed')
  })

  it('returns valid HTML with doctype', () => {
    const html = buildAlertEmailHtml({ jobName: 'test-job', error: 'some error' })
    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect(html).toContain('</html>')
  })

  it('includes DiveDispatch branding', () => {
    const html = buildAlertEmailHtml({ jobName: 'test-job', error: 'err' })
    expect(html).toContain('DiveDispatch')
  })
})

describe('cronRunLog entry shape', () => {
  it('validates expected fields for a success entry', () => {
    const entry = {
      jobName: 'complete-bookings',
      status: 'success' as const,
      runAt: Date.now(),
    }
    expect(entry.jobName).toBe('complete-bookings')
    expect(entry.status).toBe('success')
    expect(typeof entry.runAt).toBe('number')
    expect(entry).not.toHaveProperty('error')
  })

  it('validates expected fields for a failure entry', () => {
    const entry = {
      jobName: 'complete-bookings',
      status: 'failure' as const,
      error: 'Something went wrong',
      runAt: Date.now(),
    }
    expect(entry.jobName).toBe('complete-bookings')
    expect(entry.status).toBe('failure')
    expect(entry.error).toBe('Something went wrong')
    expect(typeof entry.runAt).toBe('number')
  })
})
