/**
 * Connection status for offline-first PWA behavior.
 *
 * - Online: live data from Convex subscriptions
 * - Offline: no network, operating on cached data
 * - Stale: online but displaying cached data (e.g., Convex subscription reconnecting)
 */
export enum ConnectionStatus {
  Online = 'online',
  Offline = 'offline',
  Stale = 'stale',
}

interface ConnectionInput {
  navigatorOnline: boolean
  isStale: boolean
}

/**
 * Derive connection status from browser online state and data staleness.
 */
export function getConnectionStatus(input: ConnectionInput): ConnectionStatus {
  if (!input.navigatorOnline) {
    return ConnectionStatus.Offline
  }
  if (input.isStale) {
    return ConnectionStatus.Stale
  }
  return ConnectionStatus.Online
}
