import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRosterCacheName } from '../src/lib/pwa/roster-cache'

describe('getRosterCacheName', () => {
  it('returns a versioned cache name', () => {
    const name = getRosterCacheName()
    expect(name).toBe('dd-roster-v1')
  })

  it('includes version number for cache busting', () => {
    const name = getRosterCacheName()
    expect(name).toMatch(/^dd-roster-v\d+$/)
  })
})
