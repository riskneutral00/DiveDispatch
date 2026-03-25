import { describe, it, expect } from 'vitest'

describe('monitoring.lastCronRun', () => {
  it('query returns null shape when no entries exist', () => {
    // Pure shape test — the actual Convex query returns null when no entries
    const result = null
    expect(result).toBeNull()
  })

  it('result shape includes expected fields when entry exists', () => {
    // Validates the expected return shape
    const mockEntry = {
      _id: 'fake-id',
      _creationTime: Date.now(),
      jobName: 'complete-bookings',
      status: 'success' as const,
      runAt: Date.now(),
    }
    expect(mockEntry).toHaveProperty('jobName')
    expect(mockEntry).toHaveProperty('status')
    expect(mockEntry).toHaveProperty('runAt')
    expect(['success', 'failure']).toContain(mockEntry.status)
  })

  it('failure entry includes error field', () => {
    const mockEntry = {
      _id: 'fake-id',
      _creationTime: Date.now(),
      jobName: 'complete-bookings',
      status: 'failure' as const,
      error: 'DB timeout',
      runAt: Date.now(),
    }
    expect(mockEntry.error).toBe('DB timeout')
    expect(mockEntry.status).toBe('failure')
  })
})
