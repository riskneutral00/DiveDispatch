'use client'

import { useSyncExternalStore } from 'react'
import { ConnectionStatus, getConnectionStatus } from './connection-status'

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
  return true
}

export function useConnectionStatus(isStale = false): ConnectionStatus {
  const navigatorOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getServerSnapshot
  )

  return getConnectionStatus({ navigatorOnline, isStale })
}
