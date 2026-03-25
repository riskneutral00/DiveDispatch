import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  it('returns 200 status', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
  })

  it('returns JSON content type', async () => {
    const response = await GET()
    expect(response.headers.get('content-type')).toContain('application/json')
  })

  it('returns { status: "ok", timestamp: string } shape', async () => {
    const response = await GET()
    const body = await response.json()
    expect(body).toEqual({
      status: 'ok',
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    })
  })

  it('returns a valid ISO 8601 timestamp', async () => {
    const response = await GET()
    const body = await response.json()
    const parsed = new Date(body.timestamp)
    expect(parsed.toISOString()).toBe(body.timestamp)
  })
})
