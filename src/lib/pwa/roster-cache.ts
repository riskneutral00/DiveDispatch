/**
 * Roster pre-caching for offline-first PWA.
 *
 * When the app opens with connectivity, pre-caches today's bookings/sessions
 * into the service worker cache so they are available offline on the water.
 *
 * This works alongside Convex's automatic caching — it ensures the SW cache
 * has a snapshot of roster data for the current day.
 */

const ROSTER_CACHE_NAME = 'dd-roster-v1'

/**
 * Pre-cache roster-related URLs into the service worker cache.
 * Called on app mount when the user has connectivity.
 *
 * @param urls - API/page URLs to cache (e.g., roster pages, manifest data endpoints)
 */
export async function preCacheRosterData(urls: string[]): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('caches' in window)) return

  try {
    const cache = await caches.open(ROSTER_CACHE_NAME)
    await cache.addAll(urls)
  } catch (error) {
    // Non-fatal: offline will just have less data
    console.warn('[DiveDispatch] Roster pre-cache failed:', error)
  }
}

/**
 * Clear stale roster cache (e.g., yesterday's data).
 */
export async function clearRosterCache(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('caches' in window)) return

  try {
    await caches.delete(ROSTER_CACHE_NAME)
  } catch (error) {
    console.warn('[DiveDispatch] Roster cache clear failed:', error)
  }
}

/**
 * Get the roster cache name for use in service worker config.
 */
export function getRosterCacheName(): string {
  return ROSTER_CACHE_NAME
}
