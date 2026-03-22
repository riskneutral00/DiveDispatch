import type { ResourcePickerEntry } from '@/lib/types/booking'

/**
 * Sorts entries so preferred slugs appear first (in preference order),
 * followed by remaining entries in alphabetical order.
 */
export function sortByPreference(
  entries: ResourcePickerEntry[],
  preferredSlugs: string[],
): ResourcePickerEntry[] {
  if (!preferredSlugs.length) {
    return [...entries].sort((a, b) => a.name.localeCompare(b.name))
  }
  const prefOrder = new Map(preferredSlugs.map((slug, i) => [slug, i]))
  const preferred = entries
    .filter((e) => prefOrder.has(e.slug))
    .sort((a, b) => (prefOrder.get(a.slug) ?? 0) - (prefOrder.get(b.slug) ?? 0))
  const others = entries
    .filter((e) => !prefOrder.has(e.slug))
    .sort((a, b) => a.name.localeCompare(b.name))
  return [...preferred, ...others]
}
