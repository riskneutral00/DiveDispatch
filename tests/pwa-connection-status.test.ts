import { describe, it, expect } from 'vitest'
import {
  ConnectionStatus,
  getConnectionStatus,
} from '../src/lib/pwa/connection-status'

describe('getConnectionStatus', () => {
  it('returns "online" when navigator.onLine is true and no stale flag', () => {
    const status = getConnectionStatus({ navigatorOnline: true, isStale: false })
    expect(status).toBe(ConnectionStatus.Online)
  })

  it('returns "offline" when navigator.onLine is false', () => {
    const status = getConnectionStatus({ navigatorOnline: false, isStale: false })
    expect(status).toBe(ConnectionStatus.Offline)
  })

  it('returns "stale" when online but data is stale (cached)', () => {
    const status = getConnectionStatus({ navigatorOnline: true, isStale: true })
    expect(status).toBe(ConnectionStatus.Stale)
  })

  it('returns "offline" when offline regardless of stale flag', () => {
    const status = getConnectionStatus({ navigatorOnline: false, isStale: true })
    expect(status).toBe(ConnectionStatus.Offline)
  })
})

describe('ConnectionStatus enum', () => {
  it('has three valid states', () => {
    expect(Object.values(ConnectionStatus)).toEqual(['online', 'offline', 'stale'])
  })
})
