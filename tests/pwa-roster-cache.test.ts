import { describe, it, expect } from 'vitest'
import { getRosterCacheName } from '../src/lib/pwa/roster-cache'

describe('getRosterCacheName', () => {
  it('returns a versioned cache name', () => {
    const name = getRosterCacheName()
    expect(name).toBe('dd-roster-v1')
  })

  it('returns a consistent value across calls', () => {
    expect(getRosterCacheName()).toBe(getRosterCacheName())
  })

  it('starts with dd- prefix', () => {
    expect(getRosterCacheName().startsWith('dd-')).toBe(true)
  })

  it('contains a version suffix', () => {
    expect(getRosterCacheName()).toMatch(/-v\d+$/)
  })
})
