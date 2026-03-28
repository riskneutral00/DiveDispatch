'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { ConnectionStatus, getConnectionStatus } from './connection-status'

/**
 * Subscribe to browser online/offline events via useSyncExternalStore.
 */
function subscribeOnlineStatus(callback: () => void): () => void {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine
}

function getServerSnapshot(): boolean {
  // During SSR, assume online
  return true
}

/**
 * Hook that returns the current connection status.
 * Listens to browser online/offline events and Convex subscription staleness.
 *
 * @param isStale - Whether the Convex subscription data is stale (optional, default false)
 */
export function useConnectionStatus(isStale = false): ConnectionStatus {
  const navigatorOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getServerSnapshot
  )

  return getConnectionStatus({ navigatorOnline, isStale })
}
