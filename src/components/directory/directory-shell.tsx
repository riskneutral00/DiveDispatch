'use client'

import { useQuery } from 'convex/react'
import { Search, Waves } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { DirectoryEntry } from '../../../convex/directory'
import { GlassInput } from '@/components/glass/glass-input'
import { StakeholderGrid } from './stakeholder-grid'
import { useDebounce } from '@/lib/hooks/use-debounce'

type RoleFilter =
  | 'All'
  | 'DiveCenter'
  | 'Agent'
  | 'Instructor'
  | 'Boat'
  | 'Equipment'
  | 'Pool'
  | 'Compressor'

const TABS: { key: RoleFilter; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'DiveCenter', label: 'Dive Centers' },
  { key: 'Instructor', label: 'Instructors' },
  { key: 'Boat', label: 'Boats' },
  { key: 'Equipment', label: 'Equipment' },
  { key: 'Pool', label: 'Pools' },
  { key: 'Compressor', label: 'Compressors' },
  { key: 'Agent', label: 'Agents' },
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

  const isLoading =
    diveCenters === undefined ||
    agents === undefined ||
    instructors === undefined ||
    boats === undefined ||
    equipment === undefined ||
    pools === undefined ||
    compressors === undefined

  const all: DirectoryEntry[] = [
    ...(diveCenters ?? []),
    ...(agents ?? []),
    ...(instructors ?? []),
    ...(boats ?? []),
    ...(equipment ?? []),
    ...(pools ?? []),
    ...(compressors ?? []),
  ]

  const byRole: Record<RoleFilter, DirectoryEntry[]> = {
    All: all,
    DiveCenter: diveCenters ?? [],
    Agent: agents ?? [],
    Instructor: instructors ?? [],
    Boat: boats ?? [],
    Equipment: equipment ?? [],
    Pool: pools ?? [],
    Compressor: compressors ?? [],
  }

  return { byRole, isLoading }
}

export function DirectoryShell() {
  const [selectedRole, setSelectedRole] = useState<RoleFilter>('All')
  const [searchRaw, setSearchRaw] = useState('')
  const search = useDebounce(searchRaw, 300)

  const { byRole, isLoading } = useAllRoleResults()

  const entries = useMemo(() => {
    const base = byRole[selectedRole]
    if (!search.trim()) return base
    const q = search.toLowerCase()
    return base.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.city.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q),
    )
  }, [byRole, selectedRole, search])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-surface)' }}>
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

        {/* Role filter tabs */}
        <div
          className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 mb-6"
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
                onClick={() => setSelectedRole(tab.key)}
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

        {/* Results */}
        <StakeholderGrid entries={entries} isLoading={isLoading} />
      </main>
    </div>
  )
}
