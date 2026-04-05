'use client'

import { useQuery } from 'convex/react'
import { Search, ShieldCheck, Waves } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { api } from '@/lib/convex-generated'
import { Input } from '@/components/ui/input'
import { useSessionRoleContext } from '@/components/layout/session-dashboard-shell'
import { DashboardPageFrame } from '@/components/layout/dashboard-page-frame'
import { ROLE_FILTERS } from '@/lib/constants/resource-filters'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { filterDirectoryEntries } from '@/lib/utils/directory-filters'
import type { RichDirectoryEntry } from '@/lib/types/directory'
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
  | 'DiveHostel'
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
  { key: 'DiveHostel', label: 'Dive Hostels' },
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
  const diveHostels = useQuery(api.directory.listByRole, { role: 'DiveHostel' })
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
    diveHostels === undefined ||
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
    ...(diveHostels ?? []),
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
    DiveHostel: (diveHostels ?? []) as RichDirectoryEntry[],
    DiveSite: (diveSites ?? []) as RichDirectoryEntry[],
  }

  return { byRole, isLoading }
}

export function DirectoryShell() {
  const sessionRole = useSessionRoleContext()
  const homeHref = sessionRole
    ? `/${sessionRole.slug}/${sessionRole.roleSlug}/dashboard`
    : '/dashboard'

  const [selectedRole, setSelectedRole] = useState<RoleFilter>('All')
  const [searchRaw, setSearchRaw] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [verifiedOnly, setVerifiedOnly] = useState(false)
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

  const entries = useMemo(
    () =>
      filterDirectoryEntries({
        entries: byRole[selectedRole],
        search,
        filterValues,
        verifiedOnly,
        preferredSlugs,
        selectedRole,
      }),
    [byRole, selectedRole, search, filterValues, verifiedOnly, preferredSlugs],
  )

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      {/* Top bar */}
      <header
        className="sticky top-0 z-20 glass flex items-center gap-4 px-4 py-3 sm:px-6"
        style={{
          borderBottom: '1px solid var(--color-glass-border)',
        }}
      >
        <Link href={homeHref} className="flex items-center gap-2 flex-shrink-0">
          <Waves size={20} style={{ color: 'var(--color-primary)' }} />
          <span
            className="font-bold text-sm leading-none hidden sm:block text-primary"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            DiveDispatch
          </span>
        </Link>

        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search by name, city, or country…"
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            leadingIcon={<Search size={14} />}
            aria-label="Search directory"
          />
        </div>

        {/* Verified-only toggle */}
        <button
          type="button"
          onClick={() => setVerifiedOnly((v) => !v)}
          aria-pressed={verifiedOnly}
          aria-label="Show verified only"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 flex-shrink-0"
          style={{
            background: verifiedOnly ? 'var(--color-primary)' : 'var(--color-glass-bg)',
            color: verifiedOnly
              ? 'var(--color-text-on-primary)'
              : 'var(--color-text-secondary)',
            border: `1px solid ${verifiedOnly ? 'transparent' : 'var(--color-glass-border)'}`,
            transitionDuration: 'var(--transition-speed)',
          }}
        >
          <ShieldCheck size={14} />
          <span className="hidden sm:inline">Verified</span>
        </button>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <DashboardPageFrame
          maxWidth="7xl"
          padding="none"
          title="Directory"
          className="px-4 py-6 sm:px-6 lg:px-8"
        >

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
                    setVerifiedOnly(false)
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
        </DashboardPageFrame>
      </main>
    </div>
  )
}
