import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  it('returns ok status with ISO timestamp', async () => {
    const response = await GET()
    const body = await response.json()
    expect(body).toEqual({
      status: 'ok',
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    })
  })
})
