'use client'

import { useConnectionStatus } from '../../lib/pwa/use-connection-status'
import { ConnectionStatus } from '../../lib/pwa/connection-status'

/**
 * Visual indicator shown when the app is operating on cached/offline data.
 * Hidden when fully online with fresh data.
 */
export function OfflineIndicator({ isStale = false }: { isStale?: boolean }) {
  const status = useConnectionStatus(isStale)

  if (status === ConnectionStatus.Online) {
    return null
  }

  const isOffline = status === ConnectionStatus.Offline
  const label = isOffline ? 'Offline' : 'Cached data'
  const bgClass = isOffline
    ? 'bg-destructive text-text-on-primary'
    : 'bg-warning text-text-primary'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-[var(--z-dropdown)] px-4 py-1.5 text-center text-sm font-medium ${bgClass}`}
    >
      {isOffline
        ? 'You are offline. Showing cached data.'
        : 'Reconnecting... Showing cached data.'}
    </div>
  )
}
