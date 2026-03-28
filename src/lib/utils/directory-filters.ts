import type { RichDirectoryEntry } from '@/lib/types/directory'

export type DirectoryFilterInput = {
  entries: RichDirectoryEntry[]
  search: string
  filterValues: Record<string, string>
  verifiedOnly: boolean
  preferredSlugs: string[]
  selectedRole: string
}

/**
 * Pure filtering + sorting logic extracted from DirectoryShell's useMemo.
 * Handles: text search, verified toggle, language filter, agency/gasMix
 * multi-select, capacity filter, and preferred-instructor sorting.
 */
export function filterDirectoryEntries(input: DirectoryFilterInput): RichDirectoryEntry[] {
  const { entries, search, filterValues, verifiedOnly, preferredSlugs, selectedRole } = input
  let base = [...entries]

  // ── Verified toggle ──────────────────────────────────────────────────
  if (verifiedOnly) {
    base = base.filter((e) => e.verified)
  }

  // ── Text search: name, placeName, country ────────────────────────────
  if (search.trim()) {
    const q = search.toLowerCase()
    base = base.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.placeName.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q),
    )
  }

  // ── Language filter (supports comma-separated multi-select) ─────────
  const languageFilter = filterValues['language']
  if (languageFilter && languageFilter !== 'all') {
    const selected = languageFilter.split(',').map((s) => s.trim().toUpperCase())
    base = base.filter((e) =>
      e.languages?.some((l) => selected.includes(l.toUpperCase())),
    )
  }

  // ── Agency filter (supports comma-separated multi-select) ────────────
  const agencyFilter = filterValues['agency']
  if (agencyFilter && agencyFilter !== 'all') {
    const selected = agencyFilter.split(',').map((s) => s.trim().toLowerCase())
    base = base.filter((e) =>
      e.agencies?.some((a) => selected.includes(a.toLowerCase())),
    )
  }

  // ── Capacity filter ──────────────────────────────────────────────────
  const minCapacityFilter = filterValues['minCapacity']
  if (minCapacityFilter && minCapacityFilter !== 'any') {
    const min = parseInt(minCapacityFilter, 10)
    base = base.filter((e) => (e.boatCapacity ?? 0) >= min)
  }

  // ── Gas mix filter (supports comma-separated multi-select) ───────────
  const gasMixFilter = filterValues['gasMix']
  if (gasMixFilter && gasMixFilter !== 'all') {
    const selected = gasMixFilter.split(',').map((s) => s.trim().toLowerCase())
    base = base.filter((e) =>
      e.gasMixes?.some((m) => selected.includes(m.toLowerCase())),
    )
  }

  // ── Sort preferred instructors to top ────────────────────────────────
  if (selectedRole === 'Instructor' || selectedRole === 'All') {
    base.sort((a, b) => {
      const aP = preferredSlugs.includes(a.slug) ? 0 : 1
      const bP = preferredSlugs.includes(b.slug) ? 0 : 1
      return aP - bP
    })
  }

  return base
}
