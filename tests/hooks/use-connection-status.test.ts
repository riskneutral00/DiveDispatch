// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// We need to mock useSyncExternalStore to control navigator.onLine
// since jsdom doesn't support full online/offline event simulation easily.
// Instead we test the hook indirectly via the getConnectionStatus pure function path.

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useSyncExternalStore: vi.fn(),
  }
})

import { useSyncExternalStore } from 'react'
import { useConnectionStatus } from '../../src/lib/pwa/use-connection-status'
import { ConnectionStatus } from '../../src/lib/pwa/connection-status'

const mockUseSES = vi.mocked(useSyncExternalStore)

describe('useConnectionStatus', () => {
  beforeEach(() => {
    mockUseSES.mockReset()
  })

  it('returns Online when navigator is online and data is fresh', () => {
    mockUseSES.mockReturnValue(true)
    const { result } = renderHook(() => useConnectionStatus(false))
    expect(result.current).toBe(ConnectionStatus.Online)
  })

  it('returns Offline when navigator is offline', () => {
    mockUseSES.mockReturnValue(false)
    const { result } = renderHook(() => useConnectionStatus(false))
    expect(result.current).toBe(ConnectionStatus.Offline)
  })

  it('returns Stale when online but data is stale', () => {
    mockUseSES.mockReturnValue(true)
    const { result } = renderHook(() => useConnectionStatus(true))
    expect(result.current).toBe(ConnectionStatus.Stale)
  })

  it('returns Offline when navigator offline even if stale flag is true', () => {
    mockUseSES.mockReturnValue(false)
    const { result } = renderHook(() => useConnectionStatus(true))
    expect(result.current).toBe(ConnectionStatus.Offline)
  })

  it('defaults isStale to false', () => {
    mockUseSES.mockReturnValue(true)
    const { result } = renderHook(() => useConnectionStatus())
    expect(result.current).toBe(ConnectionStatus.Online)
  })
})
