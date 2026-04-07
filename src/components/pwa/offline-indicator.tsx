'use client'

import { useConnectionStatus } from '../../lib/pwa/use-connection-status'
import { ConnectionStatus } from '../../lib/pwa/connection-status'

export function OfflineIndicator({ isStale = false }: { isStale?: boolean }) {
  const status = useConnectionStatus(isStale)

  if (status === ConnectionStatus.Online) {
    return null
  }

  const isOffline = status === ConnectionStatus.Offline
  const bgClass = isOffline
    ? 'bg-destructive text-text-on-primary'
    : 'bg-warning text-text-primary'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-[var(--z-dropdown)] px-4 py-1.5 text-center text-body font-medium ${bgClass}`}
    >
      {isOffline
        ? 'You are offline. Showing cached data.'
        : 'Reconnecting... Showing cached data.'}
    </div>
  )
}
