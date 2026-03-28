import { describe, it, expect } from 'vitest'
import { getRosterCacheName } from '../src/lib/pwa/roster-cache'

describe('getRosterCacheName', () => {
  it('returns a versioned cache name', () => {
    const name = getRosterCacheName()
    expect(name).toBe('dd-roster-v1')
  })
})
