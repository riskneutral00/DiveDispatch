'use client'

import { useQuery } from 'convex/react'
import { Search, Waves } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { GlassInput } from '@/components/glass/glass-input'
import { ROLE_FILTERS } from '@/lib/constants/resource-filters'
import { useDebounce } from '@/lib/hooks/use-debounce'
import type { RichDirectoryEntry } from './stakeholder-card'
import { FilterBar } from './filter-bar'
import { StakeholderGrid } from './stakeholder-grid'

type RoleFilter =
  | 'All'
  | 'DiveCenter'
  | 'Agent'
  | 'Instructor'
  | 'DiveMaster'
  | 'Boat'
  | 'Equipment'
  | 'Pool'
  | 'Compressor'
  | 'Liveaboard'
  | 'DiveResort'
  | 'DiveSite'

const TABS: { key: RoleFilter; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'DiveCenter', label: 'Dive Centers' },
  { key: 'Instructor', label: 'Instructors' },
  { key: 'Boat', label: 'Boats' },
  { key: 'Equipment', label: 'Equipment' },
  { key: 'Pool', label: 'Pools' },
  { key: 'Compressor', label: 'Compressors' },
  { key: 'Agent', label: 'Agents' },
  { key: 'DiveMaster', label: 'Dive Masters' },
  { key: 'Liveaboard', label: 'Liveaboards' },
  { key: 'DiveResort', label: 'Dive Resorts' },
  { key: 'DiveSite', label: 'Dive Sites' },
]

// Run all role queries in parallel. Each returns undefined while loading, [] once resolved.
function useAllRoleResults() {
  const diveCenters = useQuery(api.directory.listByRole, { role: 'DiveCenter' })
  const agents = useQuery(api.directory.listByRole, { role: 'Agent' })
  const instructors = useQuery(api.directory.listByRole, { role: 'Instructor' })
  const boats = useQuery(api.directory.listByRole, { role: 'Boat' })
  const equipment = useQuery(api.directory.listByRole, { role: 'Equipment' })
  const pools = useQuery(api.directory.listByRole, { role: 'Pool' })
  const compressors = useQuery(api.directory.listByRole, { role: 'Compressor' })
  const diveMasters = useQuery(api.directory.listByRole, { role: 'DiveMaster' })
  const liveaboards = useQuery(api.directory.listByRole, { role: 'Liveaboard' })
  const diveResorts = useQuery(api.directory.listByRole, { role: 'DiveResort' })
  const diveSites = useQuery(api.directory.listByRole, { role: 'DiveSite' })

  const isLoading =
    diveCenters === undefined ||
    agents === undefined ||
    instructors === undefined ||
    boats === undefined ||
    equipment === undefined ||
    pools === undefined ||
    compressors === undefined ||
    diveMasters === undefined ||
    liveaboards === undefined ||
    diveResorts === undefined ||
    diveSites === undefined

  const all: RichDirectoryEntry[] = [
    ...(diveCenters ?? []),
    ...(agents ?? []),
    ...(instructors ?? []),
    ...(boats ?? []),
    ...(equipment ?? []),
    ...(pools ?? []),
    ...(compressors ?? []),
    ...(diveMasters ?? []),
    ...(liveaboards ?? []),
    ...(diveResorts ?? []),
    ...(diveSites ?? []),
  ]

  const byRole: Record<RoleFilter, RichDirectoryEntry[]> = {
    All: all,
    DiveCenter: (diveCenters ?? []) as RichDirectoryEntry[],
    Agent: (agents ?? []) as RichDirectoryEntry[],
    Instructor: (instructors ?? []) as RichDirectoryEntry[],
    Boat: (boats ?? []) as RichDirectoryEntry[],
    Equipment: (equipment ?? []) as RichDirectoryEntry[],
    Pool: (pools ?? []) as RichDirectoryEntry[],
    Compressor: (compressors ?? []) as RichDirectoryEntry[],
    DiveMaster: (diveMasters ?? []) as RichDirectoryEntry[],
    Liveaboard: (liveaboards ?? []) as RichDirectoryEntry[],
    DiveResort: (diveResorts ?? []) as RichDirectoryEntry[],
    DiveSite: (diveSites ?? []) as RichDirectoryEntry[],
  }

  return { byRole, isLoading }
}

export function DirectoryShell() {
  const [selectedRole, setSelectedRole] = useState<RoleFilter>('All')
  const [searchRaw, setSearchRaw] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const search = useDebounce(searchRaw, 300)

  const { byRole, isLoading } = useAllRoleResults()

  // Preferred instructor slugs — local session state.
  // Wires to api.directory.togglePreferredInstructor once backend branch merges.
  const [preferredSlugs, setPreferredSlugs] = useState<string[]>([])
  const handleTogglePreferred = (slug: string) => {
    setPreferredSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    )
  }

  const activeFilters = selectedRole !== 'All' ? (ROLE_FILTERS[selectedRole] ?? []) : []

  const entries = useMemo(() => {
    let base = byRole[selectedRole]

    // Text search: name, placeName, country
    if (search.trim()) {
      const q = search.toLowerCase()
      base = base.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.placeName.toLowerCase().includes(q) ||
          e.country.toLowerCase().includes(q),
      )
    }

    // Role-specific client-side filters.
    // Filter IDs match the backend listByRole args (agency, minCapacity, gasMix).

    const agencyFilter = filterValues['agency']
    if (agencyFilter && agencyFilter !== 'all') {
      base = base.filter((e) =>
        e.agencies?.some((a) => a.toLowerCase() === agencyFilter.toLowerCase()),
      )
    }

    const minCapacityFilter = filterValues['minCapacity']
    if (minCapacityFilter && minCapacityFilter !== 'any') {
      const min = parseInt(minCapacityFilter, 10)
      base = base.filter((e) => (e.boatCapacity ?? 0) >= min)
    }

    const gasMixFilter = filterValues['gasMix']
    if (gasMixFilter && gasMixFilter !== 'all') {
      base = base.filter((e) =>
        e.gasMixes?.some((m) => m.toLowerCase() === gasMixFilter.toLowerCase()),
      )
    }

    // Sort preferred instructors to top
    if (selectedRole === 'Instructor' || selectedRole === 'All') {
      base = [...base].sort((a, b) => {
        const aP = preferredSlugs.includes(a.slug) ? 0 : 1
        const bP = preferredSlugs.includes(b.slug) ? 0 : 1
        return aP - bP
      })
    }

    return base
  }, [byRole, selectedRole, search, filterValues, preferredSlugs])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header
        className="sticky top-0 z-20 flex items-center gap-4 px-4 py-3 sm:px-6"
        style={{
          background: 'var(--color-glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          borderBottom: '1px solid var(--color-glass-border)',
        }}
      >
        <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
          <Waves size={20} style={{ color: 'var(--color-primary)' }} />
          <span
            className="font-bold text-sm leading-none hidden sm:block"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            DiveDispatch
          </span>
        </Link>

        <div className="flex-1 max-w-sm">
          <GlassInput
            placeholder="Search by name, city, or country…"
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            leadingIcon={<Search size={14} />}
            aria-label="Search directory"
          />
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
        <h1
          className="text-2xl font-bold mb-6"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Directory
        </h1>

        {/* Role filter tabs — horizontally scrollable on mobile */}
        <div
          className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 mb-4"
          role="tablist"
          aria-label="Filter by role"
        >
          {TABS.map((tab) => {
            const isActive = tab.key === selectedRole
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setSelectedRole(tab.key)
                  setFilterValues({})
                }}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2"
                style={{
                  background: isActive ? 'var(--color-primary)' : 'var(--color-glass-bg)',
                  color: isActive
                    ? 'var(--color-text-on-primary)'
                    : 'var(--color-text-secondary)',
                  border: `1px solid ${isActive ? 'transparent' : 'var(--color-glass-border)'}`,
                  transitionDuration: 'var(--transition-speed)',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Role-specific filter dropdowns */}
        {activeFilters.length > 0 && (
          <div className="mb-4">
            <FilterBar
              filters={activeFilters}
              values={filterValues}
              onChange={(id, value) =>
                setFilterValues((prev) => ({ ...prev, [id]: value }))
              }
            />
          </div>
        )}

        {/* Results */}
        <StakeholderGrid
          entries={entries}
          isLoading={isLoading}
          preferredSlugs={preferredSlugs}
          onTogglePreferred={handleTogglePreferred}
        />
      </main>
    </div>
  )
}
