'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import type { DirectoryEntry } from '../../../convex/directory'
import type { StakeholderRole } from '@/lib/utils/role'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassInput } from '@/components/ui/glass-input'
import { MAX_SEARCH_RESULTS } from '@/lib/constants/form-config'
import { GlassButton } from '@/components/ui/glass-button'
import { Spinner } from '@/components/ui/spinner'

// ─── Badge helper ────────────────────────────────────────────────────────────

const badgeStyle = {
  background: 'var(--color-glass-bg-elevated)',
} as const

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-2 text-xs px-1.5 py-0.5 rounded shrink-0 text-secondary" style={badgeStyle}>
      {children}
    </span>
  )
}

// ─── Core list (data-driven — no hooks) ──────────────────────────────────────

interface CoreProps {
  slugs: string[]
  onChange: (slugs: string[]) => void
  entries: DirectoryEntry[]
  label: string
  emptyNoun: string
  renderBadge?: (entry: DirectoryEntry) => React.ReactNode
}

function PreferredListCore({ slugs, onChange, entries, label, emptyNoun, renderBadge }: CoreProps) {
  const [search, setSearch] = useState('')

  const slugToEntry = Object.fromEntries(entries.map((e) => [e.slug, e]))

  const trimmed = search.trim().toLowerCase()
  const searchResults = trimmed
    ? entries.filter(
        (e) =>
          !slugs.includes(e.slug) &&
          (e.name.toLowerCase().includes(trimmed) ||
            e.placeName.toLowerCase().includes(trimmed)),
      )
    : []

  const moveUp = (index: number) => {
    if (index === 0) return
    const next = [...slugs]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next)
  }

  const moveDown = (index: number) => {
    if (index === slugs.length - 1) return
    const next = [...slugs]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onChange(next)
  }

  const remove = (index: number) => {
    onChange(slugs.filter((_, i) => i !== index))
  }

  const add = (slug: string) => {
    if (!slugs.includes(slug)) {
      onChange([...slugs, slug])
    }
    setSearch('')
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <GlassInput
          label={label}
          placeholder="Search by name or city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {searchResults.length > 0 && (
          <div
            className="absolute z-10 left-0 right-0 mt-1 rounded-[var(--border-radius)] border overflow-hidden"
            style={{
              background: 'var(--color-glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              borderColor: 'var(--color-glass-border)',
            }}
          >
            {searchResults.slice(0, MAX_SEARCH_RESULTS).map((entry) => (
              <button
                key={entry.slug}
                type="button"
                onClick={() => add(entry.slug)}
                className="w-full text-left px-3 py-2 text-sm transition-colors hover:opacity-80 text-primary"
              >
                <span className="font-medium">{entry.name}</span>
                <span className="ml-2 text-xs text-secondary">
                  {entry.placeName}
                </span>
                {renderBadge?.(entry)}
              </button>
            ))}
          </div>
        )}
      </div>

      {slugs.length === 0 ? (
        <p className="text-sm text-secondary">
          No preferred {emptyNoun} added yet.
        </p>
      ) : (
        <div className="space-y-2">
          {slugs.map((slug, index) => {
            const entry = slugToEntry[slug]
            return (
              <GlassCard key={slug} padding="sm">
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-bold w-5 text-center shrink-0 text-secondary"
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate text-primary">
                        {entry?.name ?? slug}
                      </p>
                      {entry && renderBadge?.(entry)}
                    </div>
                    {entry?.placeName && (
                      <p className="text-xs truncate text-secondary">
                        {entry.placeName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <GlassButton variant="ghost" size="sm" type="button" onClick={() => moveUp(index)} disabled={index === 0} aria-label="Move up">
                      <ChevronUp size={16} />
                    </GlassButton>
                    <GlassButton variant="ghost" size="sm" type="button" onClick={() => moveDown(index)} disabled={index === slugs.length - 1} aria-label="Move down">
                      <ChevronDown size={16} />
                    </GlassButton>
                    <GlassButton variant="destructive-ghost" size="sm" type="button" onClick={() => remove(index)} aria-label={`Remove ${emptyNoun.replace(/s$/, '')}`}>
                      <Trash2 size={16} />
                    </GlassButton>
                  </div>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Single-role wrapper (4 of 5 use cases) ─────────────────────────────────

interface SingleRoleProps {
  slugs: string[]
  onChange: (slugs: string[]) => void
  role: string
  label: string
  emptyNoun: string
  renderBadge?: (entry: DirectoryEntry) => React.ReactNode
}

function PreferredSingleRoleList({ slugs, onChange, role, label, emptyNoun, renderBadge }: SingleRoleProps) {
  const entries = useQuery(api.directory.listByRole, { role: role as StakeholderRole })

  if (entries === undefined) {
    return (
      <div className="flex items-center justify-center py-6" style={{ color: 'var(--color-primary)' }}>
        <Spinner />
      </div>
    )
  }

  return (
    <PreferredListCore
      slugs={slugs}
      onChange={onChange}
      entries={entries ?? []}
      label={label}
      emptyNoun={emptyNoun}
      renderBadge={renderBadge}
    />
  )
}

// ─── Exported pre-configured variants ────────────────────────────────────────

interface ListProps {
  slugs: string[]
  onChange: (slugs: string[]) => void
}

export function PreferredInstructorList(props: ListProps) {
  return <PreferredSingleRoleList {...props} role="Instructor" label="Add instructor" emptyNoun="instructors" />
}

export function PreferredEquipmentList(props: ListProps) {
  return <PreferredSingleRoleList {...props} role="Equipment" label="Add equipment provider" emptyNoun="equipment providers" />
}

export function PreferredBoatList(props: ListProps) {
  return (
    <PreferredSingleRoleList
      {...props}
      role="Boat"
      label="Add boat"
      emptyNoun="boats"
      renderBadge={(e) => e.boatType ? <Badge>{e.boatType}</Badge> : null}
    />
  )
}

export function PreferredCompressorList(props: ListProps) {
  return (
    <PreferredSingleRoleList
      {...props}
      role="Compressor"
      label="Add compressor"
      emptyNoun="compressors"
      renderBadge={(e) => e.gasMixes?.length ? <Badge>{e.gasMixes.join(', ')}</Badge> : null}
    />
  )
}

export function PreferredVenueList(props: ListProps) {
  const pools = useQuery(api.directory.listByRole, { role: 'Pool' })
  const diveSites = useQuery(api.directory.listByRole, { role: 'DiveSite' })

  if (pools === undefined || diveSites === undefined) {
    return (
      <div className="flex items-center justify-center py-6" style={{ color: 'var(--color-primary)' }}>
        <Spinner />
      </div>
    )
  }

  const allVenues = [...(pools ?? []), ...(diveSites ?? [])]

  return (
    <PreferredListCore
      {...props}
      entries={allVenues}
      label="Add venue"
      emptyNoun="venues"
      renderBadge={(e) => <Badge>{e.role === 'Pool' ? 'Pool' : 'Dive Site'}</Badge>}
    />
  )
}
