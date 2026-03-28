'use client'

/**
 * Register the service worker in production.
 * Call this once from the root layout or a top-level component.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null
  if (!('serviceWorker' in navigator)) return null

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })
    return registration
  } catch (error) {
    console.error('[DiveDispatch] Service worker registration failed:', error)
    return null
  }
}
