const ROSTER_CACHE_NAME = 'dd-roster-v1'

export async function preCacheRosterData(urls: string[]): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('caches' in window)) return

  try {
    const cache = await caches.open(ROSTER_CACHE_NAME)
    await cache.addAll(urls)
  } catch (error) {
    console.warn('[DiveDispatch] Roster pre-cache failed:', error)
  }
}

export async function clearRosterCache(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('caches' in window)) return

  try {
    await caches.delete(ROSTER_CACHE_NAME)
  } catch (error) {
    console.warn('[DiveDispatch] Roster cache clear failed:', error)
  }
}

export function getRosterCacheName(): string {
  return ROSTER_CACHE_NAME
}
