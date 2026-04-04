'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from 'convex/react'
import { ChevronUp, ChevronDown, Trash2, Plus, Wind } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import type { DirectoryEntry } from '../../../convex/directory'
import type { StakeholderRole } from '@/lib/utils/role'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { MAX_SEARCH_RESULTS } from '@/lib/constants/form-config'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { FlagPill } from '@/components/profiles/language-picker'
import {
  ALL_LANGUAGES,
  CHINESE_SCRIPT_LABELS,
  type LanguageCode,
} from '@/lib/constants/dive-languages'

const MAX_PREFERRED_INSTRUCTORS = 10
const chipBase = 'px-2 py-1 text-xs rounded-full border transition-colors cursor-pointer'

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
        <Input
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
              <Card key={slug} padding="sm">
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
                    <Button variant="ghost" size="sm" type="button" onClick={() => moveUp(index)} disabled={index === 0} aria-label="Move up">
                      <ChevronUp size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" type="button" onClick={() => moveDown(index)} disabled={index === slugs.length - 1} aria-label="Move down">
                      <ChevronDown size={16} />
                    </Button>
                    <Button variant="destructive-ghost" size="sm" type="button" onClick={() => remove(index)} aria-label={`Remove ${emptyNoun.replace(/s$/, '')}`}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </Card>
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
              <Card key={slug} padding="sm">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      aria-label="Move up"
                    >
                      <ChevronUp size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={index === slugs.length - 1}
                      aria-label="Move down"
                    >
                      <ChevronDown size={16} />
                    </Button>
                    <Button
                      variant="destructive-ghost"
                      size="sm"
                      type="button"
                      onClick={() => remove(index)}
                      aria-label="Remove instructor"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add button + count */}
      <div className="flex items-center justify-between">
        {!atMax && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowOverlay(true)}
          >
            <Plus size={14} className="mr-1" />
            Add Instructor
          </Button>
        )}
        <span className="ml-auto text-xs text-secondary">
          {slugs.length}/{MAX_PREFERRED_INSTRUCTORS}
        </span>
      </div>

      {/* Add instructor overlay */}
      <Dialog
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

          <Input
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
      </Dialog>
    </div>
  )
}

// ─── Shared overlay pattern ─────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={chipBase}
      style={{
        background: active ? 'var(--color-primary-muted)' : 'transparent',
        borderColor: active ? 'var(--color-primary-border)' : 'var(--color-glass-border)',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
      }}
    >
      {label}
    </button>
  )
}

interface OverlayListProps {
  slugs: string[]
  onChange: (slugs: string[]) => void
  entries: DirectoryEntry[] | undefined
  emptyText: string
  addButtonLabel: string
  dialogTitle: string
  renderRankedBadge: (entry: DirectoryEntry) => React.ReactNode
  renderBrowseBadge: (entry: DirectoryEntry) => React.ReactNode
  filterBar: React.ReactNode
  hasActiveFilter: boolean
  filteredEntries: DirectoryEntry[]
  search: string
  onSearchChange: (v: string) => void
  onResetFilters?: () => void
  noResultsText: string
  promptText: string
}

function PreferredOverlayList({
  slugs, onChange, entries, emptyText, addButtonLabel, dialogTitle,
  renderRankedBadge, renderBrowseBadge, filterBar,
  hasActiveFilter, filteredEntries, search, onSearchChange, onResetFilters,
  noResultsText, promptText,
}: OverlayListProps) {
  const [showOverlay, setShowOverlay] = useState(false)

  if (entries === undefined) {
    return (
      <div className="flex items-center justify-center py-6" style={{ color: 'var(--color-primary)' }}>
        <Spinner />
      </div>
    )
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- entries identity stable from useQuery
  const slugToEntry = useMemo(() => Object.fromEntries(entries.map((e) => [e.slug, e])), [entries])

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
  const remove = (index: number) => onChange(slugs.filter((_, i) => i !== index))
  const add = (slug: string) => {
    if (!slugs.includes(slug)) onChange([...slugs, slug])
    setShowOverlay(false)
    onSearchChange('')
  }

  return (
    <div className="space-y-3">
      {slugs.length === 0 ? (
        <p className="text-sm text-secondary">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {slugs.map((slug, index) => {
            const entry = slugToEntry[slug]
            return (
              <Card key={slug} padding="sm">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5 text-center shrink-0 text-secondary">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-primary">
                      {entry?.name ?? slug}
                    </p>
                    {entry && <div className="mt-0.5">{renderRankedBadge(entry)}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" type="button" onClick={() => moveUp(index)} disabled={index === 0} aria-label="Move up">
                      <ChevronUp size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" type="button" onClick={() => moveDown(index)} disabled={index === slugs.length - 1} aria-label="Move down">
                      <ChevronDown size={16} />
                    </Button>
                    <Button variant="destructive-ghost" size="sm" type="button" onClick={() => remove(index)} aria-label="Remove">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Button type="button" variant="ghost" size="sm" onClick={() => setShowOverlay(true)}>
        <Plus size={14} className="mr-1" />
        {addButtonLabel}
      </Button>

      <Dialog open={showOverlay} onClose={() => { setShowOverlay(false); onSearchChange(''); onResetFilters?.() }} title={dialogTitle} size="lg">
        <div className="space-y-4">
          {filterBar}
          <Input
            label={`Search ${dialogTitle.toLowerCase().replace('add ', '')}`}
            placeholder="Search by name or city..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
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
                    className="w-full text-left px-3 py-2.5 text-sm transition-colors hover:opacity-80 text-primary border-b last:border-b-0"
                    style={{ borderColor: 'var(--color-glass-border)' }}
                  >
                    <span className="font-medium">{entry.name}</span>
                    <div className="mt-0.5">{renderBrowseBadge(entry)}</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-secondary py-2">{noResultsText}</p>
            )
          ) : (
            <p className="text-sm text-secondary py-2">{promptText}</p>
          )}
        </div>
      </Dialog>
    </div>
  )
}

// ─── Venue list ─────────────────────────────────────────────────────────────

const VENUE_TYPES = ['Pool', 'Shore', 'Reef', 'Lake', 'River', 'Quarry', 'Other'] as const

function VenueBadge({ entry }: { entry: DirectoryEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {entry.venueType && <Badge>{entry.venueType}</Badge>}
      {entry.maxDepth != null && <Badge>{entry.maxDepth}m</Badge>}
      {entry.maxCapacity != null && <Badge>{entry.maxCapacity} pax</Badge>}
      {entry.hasCompressor && <Wind size={12} className="text-secondary ml-1" />}
    </div>
  )
}

export function PreferredVenueList(props: ListProps) {
  const { slugs, onChange } = props
  const pools = useQuery(api.directory.listByRole, { role: 'Pool' as StakeholderRole })
  const diveSites = useQuery(api.directory.listByRole, { role: 'DiveSite' as StakeholderRole })

  const [activeVenueType, setActiveVenueType] = useState<string | null>(null)
  const [hasCompressorFilter, setHasCompressorFilter] = useState(false)
  const [confinedFilter, setConfinedFilter] = useState(false)
  const [search, setSearch] = useState('')

  const allVenues = useMemo(() => {
    if (pools === undefined || diveSites === undefined) return undefined
    return [...(pools ?? []), ...(diveSites ?? [])]
  }, [pools, diveSites])

  const hasActiveFilter = activeVenueType !== null || hasCompressorFilter || confinedFilter || search.trim().length > 0

  const filteredEntries = useMemo(() => {
    if (!allVenues || !hasActiveFilter) return []
    let result = allVenues.filter((e) => !slugs.includes(e.slug))
    if (activeVenueType) result = result.filter((e) => e.venueType === activeVenueType)
    if (hasCompressorFilter) result = result.filter((e) => e.hasCompressor)
    if (confinedFilter) result = result.filter((e) => e.confinedCapable)
    const trimmed = search.trim().toLowerCase()
    if (trimmed) result = result.filter((e) => e.name.toLowerCase().includes(trimmed) || e.placeName.toLowerCase().includes(trimmed))
    return result
  }, [allVenues, hasActiveFilter, slugs, activeVenueType, hasCompressorFilter, confinedFilter, search])

  const filterBar = (
    <div className="flex flex-wrap gap-1.5">
      {VENUE_TYPES.map((vt) => (
        <Chip key={vt} label={vt} active={activeVenueType === vt} onClick={() => setActiveVenueType(activeVenueType === vt ? null : vt)} />
      ))}
      <Chip label="Has Compressor" active={hasCompressorFilter} onClick={() => setHasCompressorFilter(!hasCompressorFilter)} />
      <Chip label="Confined Capable" active={confinedFilter} onClick={() => setConfinedFilter(!confinedFilter)} />
    </div>
  )

  return (
    <PreferredOverlayList
      slugs={slugs}
      onChange={onChange}
      entries={allVenues}
      emptyText="No preferred venues yet — Add one to get started."
      addButtonLabel="Add Venue"
      dialogTitle="Add Venue"
      renderRankedBadge={(e) => <VenueBadge entry={e} />}
      renderBrowseBadge={(e) => <VenueBadge entry={e} />}
      filterBar={filterBar}
      hasActiveFilter={hasActiveFilter}
      filteredEntries={filteredEntries}
      search={search}
      onSearchChange={setSearch}
      onResetFilters={() => { setActiveVenueType(null); setHasCompressorFilter(false); setConfinedFilter(false) }}
      noResultsText="No venues match these filters."
      promptText="Select filters above to browse venues."
    />
  )
}

// ─── Boat list ──────────────────────────────────────────────────────────────

const BOAT_TYPES = ['day_boat', 'speedboat', 'liveaboard', 'catamaran', 'rib', 'longtail'] as const
const BOAT_TYPE_LABELS: Record<string, string> = {
  day_boat: 'Day Boat', speedboat: 'Speedboat', liveaboard: 'Liveaboard',
  catamaran: 'Catamaran', rib: 'RIB', longtail: 'Longtail',
}

function BoatBadge({ entry }: { entry: DirectoryEntry }) {
  const types = (entry.boatTypes ?? (entry.boatType ? [entry.boatType] : []))
    .map((t) => BOAT_TYPE_LABELS[t] ?? t)
  return (
    <div className="flex flex-wrap items-center gap-1">
      {types.length > 0 && <Badge>{types.join(' · ')}</Badge>}
      {entry.boatCapacity != null && <Badge>{entry.boatCapacity} pax</Badge>}
      {entry.hasCompressor && <Wind size={12} className="text-secondary ml-1" />}
    </div>
  )
}

export function PreferredBoatList(props: ListProps) {
  const { slugs, onChange } = props
  const entries = useQuery(api.directory.listByRole, { role: 'Boat' as StakeholderRole })

  const [activeBoatType, setActiveBoatType] = useState<string | null>(null)
  const [hasCompressorFilter, setHasCompressorFilter] = useState(false)
  const [search, setSearch] = useState('')

  const hasActiveFilter = activeBoatType !== null || hasCompressorFilter || search.trim().length > 0

  const filteredEntries = useMemo(() => {
    if (!entries || !hasActiveFilter) return []
    let result = entries.filter((e) => !slugs.includes(e.slug))
    if (activeBoatType) result = result.filter((e) => (e.boatTypes ?? []).includes(activeBoatType))
    if (hasCompressorFilter) result = result.filter((e) => e.hasCompressor)
    const trimmed = search.trim().toLowerCase()
    if (trimmed) result = result.filter((e) => e.name.toLowerCase().includes(trimmed) || e.placeName.toLowerCase().includes(trimmed))
    return result
  }, [entries, hasActiveFilter, slugs, activeBoatType, hasCompressorFilter, search])

  const filterBar = (
    <div className="flex flex-wrap gap-1.5">
      {BOAT_TYPES.map((bt) => (
        <Chip key={bt} label={BOAT_TYPE_LABELS[bt]} active={activeBoatType === bt} onClick={() => setActiveBoatType(activeBoatType === bt ? null : bt)} />
      ))}
      <Chip label="Has Compressor" active={hasCompressorFilter} onClick={() => setHasCompressorFilter(!hasCompressorFilter)} />
    </div>
  )

  return (
    <PreferredOverlayList
      slugs={slugs}
      onChange={onChange}
      entries={entries}
      emptyText="No preferred boats yet — Add one to get started."
      addButtonLabel="Add Boat"
      dialogTitle="Add Boat"
      renderRankedBadge={(e) => <BoatBadge entry={e} />}
      renderBrowseBadge={(e) => <BoatBadge entry={e} />}
      filterBar={filterBar}
      hasActiveFilter={hasActiveFilter}
      filteredEntries={filteredEntries}
      search={search}
      onSearchChange={setSearch}
      onResetFilters={() => { setActiveBoatType(null); setHasCompressorFilter(false) }}
      noResultsText="No boats match these filters."
      promptText="Select filters above to browse boats."
    />
  )
}

// ─── Equipment list ─────────────────────────────────────────────────────────

const GEAR_TYPES = ['bcd', 'wetsuit', 'fins', 'regulator', 'mask'] as const
const GEAR_TYPE_LABELS: Record<string, string> = {
  bcd: 'BCD', wetsuit: 'Wetsuit', fins: 'Fins', regulator: 'Regulator', mask: 'Mask',
}

function EquipmentBadge({ entry }: { entry: DirectoryEntry }) {
  const counts = entry.inventoryCounts
  if (!counts || Object.keys(counts).length === 0) return null
  const items = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
  const shown = items.slice(0, 3)
  const remaining = items.length - 3
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map(([gt, count]) => (
        <Badge key={gt}>{GEAR_TYPE_LABELS[gt] ?? gt} ×{count}</Badge>
      ))}
      {remaining > 0 && <Badge>+{remaining} more</Badge>}
    </div>
  )
}

export function PreferredEquipmentList(props: ListProps) {
  const { slugs, onChange } = props
  const entries = useQuery(api.directory.listByRole, { role: 'Equipment' as StakeholderRole })

  const [activeGearType, setActiveGearType] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const hasActiveFilter = activeGearType !== null || search.trim().length > 0

  const filteredEntries = useMemo(() => {
    if (!entries || !hasActiveFilter) return []
    let result = entries.filter((e) => !slugs.includes(e.slug))
    if (activeGearType) result = result.filter((e) => (e.inventoryCounts?.[activeGearType] ?? 0) > 0)
    const trimmed = search.trim().toLowerCase()
    if (trimmed) result = result.filter((e) => e.name.toLowerCase().includes(trimmed) || e.placeName.toLowerCase().includes(trimmed))
    return result
  }, [entries, hasActiveFilter, slugs, activeGearType, search])

  const filterBar = (
    <div className="flex flex-wrap gap-1.5">
      {GEAR_TYPES.map((gt) => (
        <Chip key={gt} label={GEAR_TYPE_LABELS[gt]} active={activeGearType === gt} onClick={() => setActiveGearType(activeGearType === gt ? null : gt)} />
      ))}
    </div>
  )

  return (
    <PreferredOverlayList
      slugs={slugs}
      onChange={onChange}
      entries={entries}
      emptyText="No preferred equipment providers yet — Add one to get started."
      addButtonLabel="Add Equipment Provider"
      dialogTitle="Add Equipment Provider"
      renderRankedBadge={(e) => <EquipmentBadge entry={e} />}
      renderBrowseBadge={(e) => <EquipmentBadge entry={e} />}
      filterBar={filterBar}
      hasActiveFilter={hasActiveFilter}
      filteredEntries={filteredEntries}
      search={search}
      onSearchChange={setSearch}
      onResetFilters={() => setActiveGearType(null)}
      noResultsText="No equipment providers match these filters."
      promptText="Select filters above to browse equipment providers."
    />
  )
}

// ─── Compressor list ────────────────────────────────────────────────────────

const GAS_MIXES = ['air', 'nitrox', 'trimix'] as const
const GAS_MIX_LABELS: Record<string, string> = {
  air: 'Air', nitrox: 'Nitrox', trimix: 'Trimix',
}

function CompressorBadge({ entry }: { entry: DirectoryEntry }) {
  const mixes = entry.gasMixes ?? []
  if (mixes.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      {mixes.map((m) => (
        <Badge key={m}>{GAS_MIX_LABELS[m] ?? m}</Badge>
      ))}
    </div>
  )
}

export function PreferredCompressorList(props: ListProps) {
  const { slugs, onChange } = props
  const entries = useQuery(api.directory.listByRole, { role: 'Compressor' as StakeholderRole })

  const [activeGasMix, setActiveGasMix] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const hasActiveFilter = activeGasMix !== null || search.trim().length > 0

  const filteredEntries = useMemo(() => {
    if (!entries || !hasActiveFilter) return []
    let result = entries.filter((e) => !slugs.includes(e.slug))
    if (activeGasMix) result = result.filter((e) => (e.gasMixes ?? []).includes(activeGasMix))
    const trimmed = search.trim().toLowerCase()
    if (trimmed) result = result.filter((e) => e.name.toLowerCase().includes(trimmed) || e.placeName.toLowerCase().includes(trimmed))
    return result
  }, [entries, hasActiveFilter, slugs, activeGasMix, search])

  const filterBar = (
    <div className="flex flex-wrap gap-1.5">
      {GAS_MIXES.map((gm) => (
        <Chip key={gm} label={GAS_MIX_LABELS[gm]} active={activeGasMix === gm} onClick={() => setActiveGasMix(activeGasMix === gm ? null : gm)} />
      ))}
    </div>
  )

  return (
    <PreferredOverlayList
      slugs={slugs}
      onChange={onChange}
      entries={entries}
      emptyText="No preferred compressors yet — Add one to get started."
      addButtonLabel="Add Compressor"
      dialogTitle="Add Compressor"
      renderRankedBadge={(e) => <CompressorBadge entry={e} />}
      renderBrowseBadge={(e) => <CompressorBadge entry={e} />}
      filterBar={filterBar}
      hasActiveFilter={hasActiveFilter}
      filteredEntries={filteredEntries}
      search={search}
      onSearchChange={setSearch}
      onResetFilters={() => setActiveGasMix(null)}
      noResultsText="No compressors match these filters."
      promptText="Select filters above to browse compressors."
    />
  )
}
