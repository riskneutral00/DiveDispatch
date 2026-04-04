'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from 'convex/react'
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import type { DirectoryEntry } from '../../../convex/directory'
import type { StakeholderRole } from '@/lib/utils/role'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassInput } from '@/components/ui/glass-input'
import { GlassDialog } from '@/components/ui/glass-dialog'
import { MAX_SEARCH_RESULTS } from '@/lib/constants/form-config'
import { GlassButton } from '@/components/ui/glass-button'
import { Spinner } from '@/components/ui/spinner'
import { FlagPill } from '@/components/profiles/language-picker'
import {
  ALL_LANGUAGES,
  CHINESE_SCRIPT_LABELS,
  type LanguageCode,
} from '@/lib/constants/dive-languages'

const MAX_PREFERRED_INSTRUCTORS = 10

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

// ─── Instructor filter bar (presentational) ────────────────────────────────

interface FilterBarProps {
  agencies: string[]
  activeAgency: string | null
  onAgencyChange: (agency: string | null) => void
  specialties: string[]
  activeSpecialty: string | null
  onSpecialtyChange: (specialty: string | null) => void
  languageCodes: string[]
  activeLangs: Set<string>
  onLangToggle: (code: string) => void
  currentCount: number
}

const chipBase =
  'px-2 py-1 text-xs rounded-full border transition-colors cursor-pointer'

function InstructorFilterBar({
  agencies,
  activeAgency,
  onAgencyChange,
  specialties,
  activeSpecialty,
  onSpecialtyChange,
  languageCodes,
  activeLangs,
  onLangToggle,
  currentCount,
}: FilterBarProps) {
  return (
    <div className="space-y-2">
      {/* Agency chips */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-xs text-secondary mr-1">Agency</span>
        {agencies.map((agency) => {
          const isActive = activeAgency === agency
          return (
            <button
              key={agency}
              type="button"
              onClick={() => onAgencyChange(isActive ? null : agency)}
              className={chipBase}
              style={{
                background: isActive ? 'var(--color-primary-muted)' : 'transparent',
                borderColor: isActive ? 'var(--color-primary-border)' : 'var(--color-glass-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              {agency}
            </button>
          )
        })}
        <span className="ml-auto text-xs text-secondary">
          {currentCount}/{MAX_PREFERRED_INSTRUCTORS}
        </span>
      </div>

      {/* Specialty chips (visible only when agency selected) */}
      {activeAgency && specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-secondary mr-1">Specialty</span>
          {specialties.map((spec) => {
            const isActive = activeSpecialty === spec
            return (
              <button
                key={spec}
                type="button"
                onClick={() => onSpecialtyChange(isActive ? null : spec)}
                className={chipBase}
                style={{
                  background: isActive ? 'var(--color-primary-muted)' : 'transparent',
                  borderColor: isActive ? 'var(--color-primary-border)' : 'var(--color-glass-border)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {spec}
              </button>
            )
          })}
        </div>
      )}

      {/* Language chips */}
      {languageCodes.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-xs text-secondary mr-1">Language</span>
          {languageCodes.map((code) => {
            const lang = ALL_LANGUAGES.find((l) => l.code === code)
            if (!lang) return null
            return (
              <FlagPill
                key={code}
                lang={{ code: lang.code, label: lang.label }}
                active={activeLangs.has(code)}
                onToggle={() => onLangToggle(code)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Rich badge for instructor cards (browse results in overlay) ─────────────

function InstructorBadge({
  entry,
  activeAgency,
}: {
  entry: DirectoryEntry
  activeAgency: string | null
}) {
  return (
    <div className="space-y-1">
      {/* Agency + specialty row */}
      <span className="flex flex-wrap gap-1 items-center">
        {entry.agencies?.map((a) => (
          <span
            key={a}
            className="text-xs px-1.5 py-0.5 rounded shrink-0"
            style={{
              background: 'var(--color-glass-bg-elevated)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {a}
          </span>
        ))}
        {activeAgency && entry.credentials
          ?.filter((c) => c.agency === activeAgency)
          .flatMap((c) => c.courses)
          .map((course) => (
            <span
              key={course}
              className="text-xs px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: 'var(--color-glass-bg)',
                borderColor: 'var(--color-glass-border)',
                color: 'var(--color-text-secondary)',
                border: '1px solid',
              }}
            >
              {course}
            </span>
          ))}
      </span>
      {/* Language flags — standalone row */}
      {(entry.languages?.length ?? 0) > 0 && (
        <span className="flex flex-wrap gap-1 items-center">
          {entry.languages?.map((langCode) => {
            const scriptLabel = CHINESE_SCRIPT_LABELS[langCode as LanguageCode]
            const lang = ALL_LANGUAGES.find((l) => l.code === langCode)
            if (!lang) return null
            return (
              <FlagPill
                key={langCode}
                lang={{ code: lang.code, label: scriptLabel ?? lang.label }}
                active={false}
                onToggle={() => {}}
                disabled
              />
            )
          })}
        </span>
      )}
    </div>
  )
}

// ─── Compact badge for ranked list cards ─────────────────────────────────────

function InstructorRankedBadge({ entry }: { entry: DirectoryEntry }) {
  return (
    <div className="space-y-1">
      {(entry.agencies?.length ?? 0) > 0 && (
        <span className="flex flex-wrap gap-1 items-center">
          {entry.agencies?.map((a) => (
            <span
              key={a}
              className="text-xs px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: 'var(--color-glass-bg-elevated)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {a}
            </span>
          ))}
        </span>
      )}
      {(entry.languages?.length ?? 0) > 0 && (
        <span className="flex flex-wrap gap-1 items-center">
          {entry.languages?.map((langCode) => {
            const scriptLabel = CHINESE_SCRIPT_LABELS[langCode as LanguageCode]
            const lang = ALL_LANGUAGES.find((l) => l.code === langCode)
            if (!lang) return null
            return (
              <FlagPill
                key={langCode}
                lang={{ code: lang.code, label: scriptLabel ?? lang.label }}
                active={false}
                onToggle={() => {}}
                disabled
              />
            )
          })}
        </span>
      )}
    </div>
  )
}

// ─── PreferredInstructorList (overlay pattern) ──────────────────────────────

export function PreferredInstructorList(props: ListProps) {
  const { slugs, onChange } = props

  const entries = useQuery(api.directory.listByRole, { role: 'Instructor' as StakeholderRole })

  // Overlay open state
  const [showOverlay, setShowOverlay] = useState(false)

  // Filter state — only active inside the overlay
  const [agency, setAgency] = useState<string | null>(null)
  const [specialty, setSpecialty] = useState<string | null>(null)
  const [activeLangs, setActiveLangs] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  // Derive filter options from full unfiltered entries
  const allAgencies = useMemo(() => {
    if (!entries) return []
    const set = new Set<string>()
    for (const e of entries) {
      for (const a of e.agencies ?? []) set.add(a)
    }
    return Array.from(set).sort()
  }, [entries])

  const specialtiesForAgency = useMemo(() => {
    if (!entries || !agency) return []
    const set = new Set<string>()
    for (const e of entries) {
      for (const c of e.credentials ?? []) {
        if (c.agency === agency) {
          for (const course of c.courses) set.add(course)
        }
      }
    }
    return Array.from(set).sort()
  }, [entries, agency])

  const allLanguageCodes = useMemo(() => {
    if (!entries) return []
    const set = new Set<string>()
    for (const e of entries) {
      for (const l of e.languages ?? []) set.add(l)
    }
    return Array.from(set).sort()
  }, [entries])

  const handleAgencyChange = (newAgency: string | null) => {
    setAgency(newAgency)
    setSpecialty(null)
  }

  const handleSpecialtyChange = useCallback((s: string | null) => {
    if (!agency) return
    setSpecialty(s)
  }, [agency])

  const handleLangToggle = (code: string) => {
    setActiveLangs((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  // Results only when user has interacted with at least one filter
  const hasActiveFilter =
    agency !== null ||
    specialty !== null ||
    activeLangs.size > 0 ||
    search.trim().length > 0

  const filteredEntries = useMemo(() => {
    if (!entries || !hasActiveFilter) return []
    let result = entries.filter((e) => !slugs.includes(e.slug))

    if (agency) {
      result = result.filter((e) => e.agencies?.includes(agency))
    }
    if (agency && specialty) {
      result = result.filter((e) =>
        e.credentials?.some((c) => c.agency === agency && c.courses.includes(specialty)),
      )
    }
    if (activeLangs.size > 0) {
      result = result.filter((e) => e.languages?.some((l) => activeLangs.has(l)))
    }
    const trimmed = search.trim().toLowerCase()
    if (trimmed) {
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(trimmed) ||
          e.placeName.toLowerCase().includes(trimmed),
      )
    }
    return result
  }, [entries, hasActiveFilter, slugs, agency, specialty, activeLangs, search])

  if (entries === undefined) {
    return (
      <div className="flex items-center justify-center py-6" style={{ color: 'var(--color-primary)' }}>
        <Spinner />
      </div>
    )
  }

  const atMax = slugs.length >= MAX_PREFERRED_INSTRUCTORS
  const slugToEntry = Object.fromEntries(entries.map((e) => [e.slug, e]))

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
    if (!slugs.includes(slug) && !atMax) {
      onChange([...slugs, slug])
    }
    setShowOverlay(false)
    setSearch('')
  }

  const closeOverlay = () => {
    setShowOverlay(false)
    setSearch('')
  }

  return (
    <div className="space-y-3">
      {/* Ranked list or empty state */}
      {slugs.length === 0 ? (
        <p className="text-sm text-secondary">
          No preferred instructors yet — Add one to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {slugs.map((slug, index) => {
            const entry = slugToEntry[slug]
            return (
              <GlassCard key={slug} padding="sm">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5 text-center shrink-0 text-secondary">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-primary">
                      {entry?.name ?? slug}
                    </p>
                    {entry && (
                      <div className="mt-0.5">
                        <InstructorRankedBadge entry={entry} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      aria-label="Move up"
                    >
                      <ChevronUp size={16} />
                    </GlassButton>
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={index === slugs.length - 1}
                      aria-label="Move down"
                    >
                      <ChevronDown size={16} />
                    </GlassButton>
                    <GlassButton
                      variant="destructive-ghost"
                      size="sm"
                      type="button"
                      onClick={() => remove(index)}
                      aria-label="Remove instructor"
                    >
                      <Trash2 size={16} />
                    </GlassButton>
                  </div>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}

      {/* Add button + count */}
      <div className="flex items-center justify-between">
        {!atMax && (
          <GlassButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowOverlay(true)}
          >
            <Plus size={14} className="mr-1" />
            Add Instructor
          </GlassButton>
        )}
        <span className="ml-auto text-xs text-secondary">
          {slugs.length}/{MAX_PREFERRED_INSTRUCTORS}
        </span>
      </div>

      {/* Add instructor overlay */}
      <GlassDialog
        open={showOverlay}
        onClose={closeOverlay}
        title="Add Instructor"
        size="lg"
      >
        <div className="space-y-4">
          <InstructorFilterBar
            agencies={allAgencies}
            activeAgency={agency}
            onAgencyChange={handleAgencyChange}
            specialties={specialtiesForAgency}
            activeSpecialty={specialty}
            onSpecialtyChange={handleSpecialtyChange}
            languageCodes={allLanguageCodes}
            activeLangs={activeLangs}
            onLangToggle={handleLangToggle}
            currentCount={slugs.length}
          />

          <GlassInput
            label="Search instructors"
            placeholder="Search by name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {hasActiveFilter ? (
            filteredEntries.length > 0 ? (
              <div
                className="rounded-[var(--border-radius)] border overflow-hidden"
                style={{
                  background: 'var(--color-glass-bg)',
                  backdropFilter: 'blur(var(--glass-blur))',
                  WebkitBackdropFilter: 'blur(var(--glass-blur))',
                  borderColor: 'var(--color-glass-border)',
                }}
              >
                {filteredEntries.slice(0, MAX_SEARCH_RESULTS).map((entry) => (
                  <button
                    key={entry.slug}
                    type="button"
                    onClick={() => add(entry.slug)}
                    disabled={atMax}
                    className="w-full text-left px-3 py-2.5 text-sm transition-colors hover:opacity-80 text-primary disabled:opacity-40 disabled:cursor-not-allowed border-b last:border-b-0"
                    style={{ borderColor: 'var(--color-glass-border)' }}
                  >
                    <span className="font-medium">{entry.name}</span>
                    <div className="mt-0.5">
                      <InstructorBadge entry={entry} activeAgency={agency} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-secondary py-2">No instructors match these filters.</p>
            )
          ) : (
            <p className="text-sm text-secondary py-2">Select filters above to browse instructors.</p>
          )}
        </div>
      </GlassDialog>
    </div>
  )
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
