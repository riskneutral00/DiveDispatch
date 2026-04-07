'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from 'convex/react'
import { ChevronLeft, ChevronRight, Trash2, Plus, GripVertical, Wind } from 'lucide-react'
import { DragDropProvider } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { api } from '@/lib/convex-generated'
import type { DirectoryEntry } from '../../../convex/directory'
import type { StakeholderRole } from '@/lib/utils/role'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { BOAT_TYPE_LABELS } from '@/lib/constants/boat-types'
import { GAS_MIXES, GAS_MIX_LABELS } from '@/lib/constants/gas-mixes'
import { GEAR_TYPES, GEAR_TYPE_LABELS, type GearType } from '@/lib/constants/gear-sizing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { LanguagePicker, type Language } from '@/components/profiles/language-picker'
import { InstructorCardContent } from '@/components/profiles/instructor-card'
import { ALL_LANGUAGES } from '@/lib/constants/dive-languages'

const MAX_PREFERRED_INSTRUCTORS = 10
const MAX_PREFERRED_VENUES = 10
const MAX_PREFERRED_BOATS = 10
const MAX_PREFERRED_EQUIPMENT = 10
const MAX_PREFERRED_COMPRESSORS = 10
const chipBase = 'px-2 py-1 text-label rounded-full border transition-colors duration-theme cursor-pointer'

const OVERLAY_LIST_HEIGHT = 380
const PAGE_SIZE = 10

interface ListProps {
  slugs: string[]
  onChange: (slugs: string[]) => void
  required?: boolean
}

interface FilterBarProps {
  agencies: string[]
  activeAgency: string | null
  onAgencyChange: (agency: string | null) => void
  specialties: string[]
  activeSpecialties: Set<string>
  onSpecialtyToggle: (specialty: string) => void
  activeLangs: Language[]
  onLangsChange: (langs: Language[]) => void
  customerLanguageCodes: string[]
  currentCount: number
  required?: boolean
}

function InstructorFilterBar({
  agencies,
  activeAgency,
  onAgencyChange,
  specialties,
  activeSpecialties,
  onSpecialtyToggle,
  activeLangs,
  onLangsChange,
  customerLanguageCodes,
  currentCount,
  required,
}: FilterBarProps) {
  return (
    <div className="space-y-2">

      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-label text-secondary mr-1">Agency</span>
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
        <span className="ml-auto text-label text-secondary">
          {currentCount}/{MAX_PREFERRED_INSTRUCTORS}
          {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
        </span>
      </div>

      {activeAgency && specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-label text-secondary mr-1">Specialties</span>
          {specialties.map((spec) => {
            const isActive = activeSpecialties.has(spec)
            return (
              <button
                key={spec}
                type="button"
                onClick={() => onSpecialtyToggle(spec)}
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

      <div className="space-y-1">
        <span className="text-label text-secondary">Languages</span>
        <LanguagePicker
          value={activeLangs}
          onChange={onLangsChange}
          max={4}
          popularCodes={customerLanguageCodes}
        />
      </div>
    </div>
  )
}

function InstructorCandidateRow({
  entry,
  slug,
  onAdd,
  disabled,
  isLast,
}: {
  entry: DirectoryEntry | undefined
  slug: string
  onAdd: () => void
  disabled: boolean
  isLast: boolean
}) {
  return (
    <div className="py-2.5 px-3">
      <InstructorCardContent
        entry={entry}
        slug={slug}
        action={
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={onAdd}
            disabled={disabled}
            aria-label="Add instructor"
            className="shrink-0"
          >
            <Plus size={16} />
          </Button>
        }
      />
      {!isLast && (
        <div
          className="mt-2.5"
          style={{ borderBottom: '1px solid var(--color-glass-border)' }}
        />
      )}
    </div>
  )
}

function SortableInstructorRow({
  slug,
  index,
  entry,
  onRemove,
  isLast,
}: {
  slug: string
  index: number
  entry: DirectoryEntry | undefined
  onRemove: () => void
  isLast: boolean
}) {
  const { ref, handleRef, isDragging } = useSortable({ id: slug, index, group: 'instructors' })

  return (
    <div
      ref={ref}
      className="py-2.5"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="flex gap-2">

        <button
          ref={handleRef}
          type="button"
          className="shrink-0 mt-0.5 cursor-grab active:cursor-grabbing text-secondary hover:text-primary transition-colors duration-theme"
          aria-label="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>

        <InstructorCardContent
          entry={entry}
          slug={slug}
          action={
            <Button
              variant="destructive-ghost"
              size="sm"
              type="button"
              onClick={onRemove}
              aria-label="Remove instructor"
              className="shrink-0"
            >
              <Trash2 size={16} />
            </Button>
          }
        />
      </div>

      {!isLast && (
        <div
          className="mt-2.5"
          style={{ borderBottom: '1px solid var(--color-glass-border)' }}
        />
      )}
    </div>
  )
}

export function PreferredInstructorList(props: ListProps) {
  const { slugs, onChange } = props

  const entries = useQuery(api.directory.listByRole, { role: 'Instructor' as StakeholderRole })
  const diveCenterProfile = useQuery(api.diveCenters.mine)

  const [showOverlay, setShowOverlay] = useState(false)

  const operatorDefaultAgency = useMemo(() => {
    const assocs = diveCenterProfile?.associations ?? []
    return assocs.length === 1 ? assocs[0].agency : null
  }, [diveCenterProfile])

  const operatorDefaultLangs = useMemo(() => {
    return (diveCenterProfile?.customerLanguages ?? [])
      .map((code) => {
        const lang = ALL_LANGUAGES.find((l) => l.code === code)
        return lang ? { code: lang.code, label: lang.label } : null
      })
      .filter(Boolean) as Language[]
  }, [diveCenterProfile])

  const [agency, setAgency] = useState<string | null>(null)
  const [activeSpecialties, setActiveSpecialties] = useState<Set<string>>(new Set())
  const [activeLangs, setActiveLangs] = useState<Language[]>([])
  const [search, setSearch] = useState('')
  const [defaultsApplied, setDefaultsApplied] = useState(false)
  const [page, setPage] = useState(0)

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
          for (const rating of c.specialtyRatings) {
            set.add(rating)
          }
        }
      }
    }
    return Array.from(set).sort()
  }, [entries, agency])

  const handleAgencyChange = (newAgency: string | null) => {
    setAgency(newAgency)
    setActiveSpecialties(new Set())
    setPage(0)
  }

  const handleSpecialtyToggle = useCallback((spec: string) => {
    if (!agency) return
    setActiveSpecialties((prev) => {
      const next = new Set(prev)
      if (next.has(spec)) next.delete(spec)
      else next.add(spec)
      return next
    })
    setPage(0)
  }, [agency])

  const handleLangsChange = (langs: Language[]) => {
    setActiveLangs(langs)
    setPage(0)
  }

  const filteredEntries = useMemo(() => {
    if (!entries) return []
    let result = entries.filter((e) => !slugs.includes(e.slug))

    if (agency) {
      result = result.filter((e) => e.agencies?.includes(agency))
    }
    if (agency && activeSpecialties.size > 0) {
      result = result.filter((e) =>
        e.credentials?.some((c) =>
          c.agency === agency && [...activeSpecialties].every((s) => c.specialtyRatings.includes(s))
        )
      )
    }
    if (activeLangs.length > 0) {
      const codes = new Set(activeLangs.map((l) => l.code))
      result = result.filter((e) => e.languages?.some((l) => codes.has(l)))
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
  }, [entries, slugs, agency, activeSpecialties, activeLangs, search])

  if (entries === undefined) {
    return (
      <div className="flex items-center justify-center py-6 text-primary">
        <Spinner />
      </div>
    )
  }

  const atMax = slugs.length >= MAX_PREFERRED_INSTRUCTORS
  const slugToEntry = Object.fromEntries(entries.map((e) => [e.slug, e]))

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))
  const paginatedEntries = filteredEntries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const remove = (index: number) => {
    onChange(slugs.filter((_, i) => i !== index))
  }

  const add = (slug: string) => {
    if (!slugs.includes(slug) && !atMax) {
      onChange([...slugs, slug])
      const remainingOnPage = paginatedEntries.filter((e) => e.slug !== slug).length
      if (remainingOnPage === 0 && page > 0) setPage((p) => p - 1)
    }
    setSearch('')
  }

  const openOverlay = () => {
    if (!defaultsApplied && diveCenterProfile) {
      setAgency(operatorDefaultAgency)
      setActiveLangs(operatorDefaultLangs)
      setDefaultsApplied(true)
    }
    setPage(0)
    setShowOverlay(true)
  }

  const closeOverlay = () => {
    setShowOverlay(false)
    setSearch('')
  }

  return (
    <div className="space-y-3">

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openOverlay}
            disabled={atMax}
          >
            <Plus size={14} className="mr-1" />
            Add Instructor
          </Button>
        </span>
        <span className="text-label text-secondary">
          {slugs.length}/{MAX_PREFERRED_INSTRUCTORS}
          {props.required && <span className="ml-1 text-destructive" aria-hidden>*</span>}
        </span>
      </div>

      {slugs.length > 0 && (
        <DragDropProvider
          onDragEnd={(event) => {
            const { source, target } = event.operation
            if (source && target && source.id !== target.id) {
              const oldIndex = slugs.indexOf(source.id as string)
              const newIndex = slugs.indexOf(target.id as string)
              if (oldIndex !== -1 && newIndex !== -1) {
                const next = [...slugs]
                const [moved] = next.splice(oldIndex, 1)
                next.splice(newIndex, 0, moved)
                onChange(next)
              }
            }
          }}
        >
          <div>
            {slugs.map((slug, index) => (
              <SortableInstructorRow
                key={slug}
                slug={slug}
                index={index}
                entry={slugToEntry[slug]}
                onRemove={() => remove(index)}
                isLast={index === slugs.length - 1}
              />
            ))}
          </div>
        </DragDropProvider>
      )}

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
            activeSpecialties={activeSpecialties}
            onSpecialtyToggle={handleSpecialtyToggle}
            activeLangs={activeLangs}
            onLangsChange={handleLangsChange}
            customerLanguageCodes={diveCenterProfile?.customerLanguages ?? []}
            currentCount={slugs.length}
            required={props.required}
          />

          <Input
            label="Search instructors"
            placeholder="Search by name or city..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          />

          <div
            className="rounded-theme overflow-hidden flex flex-col glass-elevated"
            style={{
              minHeight: OVERLAY_LIST_HEIGHT,
              maxHeight: OVERLAY_LIST_HEIGHT,
              background: 'var(--color-surface-elevated)',
            }}
          >
            <div className="flex-1 overflow-y-auto">
              {filteredEntries.length > 0 ? (
                paginatedEntries.map((entry, i) => (
                  <InstructorCandidateRow
                    key={entry.slug}
                    entry={entry}
                    slug={entry.slug}
                    onAdd={() => add(entry.slug)}
                    disabled={atMax}
                    isLast={i === paginatedEntries.length - 1}
                  />
                ))
              ) : (
                <EmptyState message="No instructors match these filters." />
              )}
            </div>
            {totalPages > 1 && (
              <div
                className="flex items-center justify-between px-3 py-2 shrink-0 border-t"
                style={{ borderColor: 'var(--color-glass-border)' }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-label text-secondary">{page + 1} / {totalPages}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                  aria-label="Next page"
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  )
}

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
  addButtonLabel: string
  dialogTitle: string
  maxItems: number
  required?: boolean
  renderBadge: (entry: DirectoryEntry) => React.ReactNode
  filterBar: React.ReactNode
  filteredEntries: DirectoryEntry[]
  search: string
  onSearchChange: (v: string) => void
  onResetFilters?: () => void
  noResultsText: string
  dndGroup: string
}

function SortableOverlayRow({
  slug,
  index,
  entry,
  onRemove,
  isLast,
  renderBadge,
  group,
}: {
  slug: string
  index: number
  entry: DirectoryEntry | undefined
  onRemove: () => void
  isLast: boolean
  renderBadge: (entry: DirectoryEntry) => React.ReactNode
  group: string
}) {
  const { ref, handleRef, isDragging } = useSortable({ id: slug, index, group })
  return (
    <div ref={ref} className="py-2" style={{ opacity: isDragging ? 0.5 : 1 }}>
      <div className="flex items-center gap-3">
        <button ref={handleRef} type="button" className="shrink-0 cursor-grab active:cursor-grabbing text-secondary hover:text-primary transition-colors duration-theme" aria-label="Drag to reorder">
          <GripVertical size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-body font-medium truncate text-primary">{entry?.name ?? slug}</p>
          {entry && <div className="mt-0.5">{renderBadge(entry)}</div>}
        </div>
        <Button variant="destructive-ghost" size="sm" type="button" onClick={onRemove} aria-label="Remove" className="shrink-0">
          <Trash2 size={16} />
        </Button>
      </div>
      {!isLast && <div className="mt-2" style={{ borderBottom: '1px solid var(--color-glass-border)' }} />}
    </div>
  )
}

function PreferredOverlayList({
  slugs, onChange, entries, addButtonLabel, dialogTitle, maxItems, required,
  renderBadge, filterBar,
  filteredEntries, search, onSearchChange, onResetFilters,
  noResultsText, dndGroup,
}: OverlayListProps) {
  const [showOverlay, setShowOverlay] = useState(false)
  const [page, setPage] = useState(0)

  const [prevSearch, setPrevSearch] = useState(search)
  if (search !== prevSearch) {
    setPrevSearch(search)
    setPage(0)
  }

  const slugToEntry = useMemo(
    () => entries ? Object.fromEntries(entries.map((e) => [e.slug, e])) : {},
    [entries],
  )

  const [prevFilterLen, setPrevFilterLen] = useState(filteredEntries.length)
  if (filteredEntries.length !== prevFilterLen) {
    setPrevFilterLen(filteredEntries.length)
    setPage(0)
  }

  if (entries === undefined) {
    return (
      <div className="flex items-center justify-center py-6 text-primary">
        <Spinner />
      </div>
    )
  }

  const atMax = slugs.length >= maxItems
  const remove = (index: number) => onChange(slugs.filter((_, i) => i !== index))
  const add = (slug: string) => {
    if (!slugs.includes(slug) && !atMax) onChange([...slugs, slug])
  }

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))
  const safePage = Math.min(page, Math.max(0, totalPages - 1))
  const paginatedEntries = filteredEntries.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={() => { setPage(0); setShowOverlay(true) }} disabled={atMax}>
          <Plus size={14} className="mr-1" />
          {addButtonLabel}
        </Button>
        <span className="text-label text-secondary">
          {slugs.length}/{maxItems}
          {required && <span className="ml-1 text-destructive" aria-hidden>*</span>}
        </span>
      </div>

      {slugs.length > 0 && (
        <DragDropProvider
          onDragEnd={(event) => {
            const { source, target } = event.operation
            if (source && target && source.id !== target.id) {
              const oldIndex = slugs.indexOf(source.id as string)
              const newIndex = slugs.indexOf(target.id as string)
              if (oldIndex !== -1 && newIndex !== -1) {
                const next = [...slugs]
                const [moved] = next.splice(oldIndex, 1)
                next.splice(newIndex, 0, moved)
                onChange(next)
              }
            }
          }}
        >
          <div>
            {slugs.map((slug, index) => (
              <SortableOverlayRow
                key={slug}
                slug={slug}
                index={index}
                entry={slugToEntry[slug]}
                onRemove={() => remove(index)}
                isLast={index === slugs.length - 1}
                renderBadge={renderBadge}
                group={dndGroup}
              />
            ))}
          </div>
        </DragDropProvider>
      )}

      <Dialog open={showOverlay} onClose={() => { setShowOverlay(false); onSearchChange(''); onResetFilters?.() }} title={dialogTitle} size="lg">
        <div className="space-y-4">
          {filterBar}
          <Input
            label={`Search ${dialogTitle.toLowerCase().replace('add ', '')}`}
            placeholder="Search by name or city..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <div
            className="rounded-theme overflow-hidden flex flex-col glass-elevated"
            style={{
              minHeight: OVERLAY_LIST_HEIGHT,
              maxHeight: OVERLAY_LIST_HEIGHT,
              background: 'var(--color-surface-elevated)',
            }}
          >
            <div className="flex-1 overflow-y-auto">
              {paginatedEntries.length > 0 ? (
                paginatedEntries.map((entry) => (
                  <button
                    key={entry.slug}
                    type="button"
                    onClick={() => add(entry.slug)}
                    disabled={atMax}
                    className="w-full text-left px-3 py-2.5 text-body transition-colors duration-theme hover:opacity-80 text-primary border-b last:border-b-0"
                    style={{ borderColor: 'var(--color-glass-border)' }}
                  >
                    <span className="font-medium">{entry.name}</span>
                    <span className="ml-2 text-label text-secondary">{entry.placeName}</span>
                    <div className="mt-0.5">{renderBadge(entry)}</div>
                  </button>
                ))
              ) : (
                <p className="text-body text-secondary py-6 px-3">{noResultsText}</p>
              )}
            </div>
            {totalPages > 1 && (
              <div
                className="flex items-center justify-between px-3 py-2 shrink-0 border-t"
                style={{ borderColor: 'var(--color-glass-border)' }}
              >
                <Button variant="ghost" size="sm" type="button" onClick={() => setPage((p) => p - 1)} disabled={safePage === 0} aria-label="Previous page">
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-label text-secondary">{safePage + 1} / {totalPages}</span>
                <Button variant="ghost" size="sm" type="button" onClick={() => setPage((p) => p + 1)} disabled={safePage >= totalPages - 1} aria-label="Next page">
                  <ChevronRight size={14} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function VenueBadge({ entry }: { entry: DirectoryEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {entry.venueType && <Badge variant="muted" size="sm">{entry.venueType}</Badge>}
      {entry.maxDepth != null && <Badge variant="muted" size="sm">{entry.maxDepth}m</Badge>}
      {entry.maxCapacity != null && <Badge variant="muted" size="sm">{entry.maxCapacity} pax</Badge>}
      {entry.hasCompressor && <Wind size={12} className="text-secondary ml-1" />}
    </div>
  )
}

function BoatBadge({ entry }: { entry: DirectoryEntry }) {
  const types = (entry.boatTypes ?? (entry.boatType ? [entry.boatType] : []))
    .map((t) => BOAT_TYPE_LABELS[t] ?? t)
  return (
    <div className="flex flex-wrap items-center gap-1">
      {types.length > 0 && <Badge variant="muted" size="sm">{types.join(' · ')}</Badge>}
      {entry.boatCapacity != null && <Badge variant="muted" size="sm">{entry.boatCapacity} pax</Badge>}
      {entry.hasCompressor && <Wind size={12} className="text-secondary ml-1" />}
    </div>
  )
}

function VenueOrBoatBadge({ entry }: { entry: DirectoryEntry }) {
  return entry.role === 'Boat' ? <BoatBadge entry={entry} /> : <VenueBadge entry={entry} />
}

type VenueBoatFilter = 'all' | 'venue' | 'boat'

export function PreferredVenueBoatList({ venueSlugs, boatSlugs, onVenueChange, onBoatChange, required }: {
  venueSlugs: string[]
  boatSlugs: string[]
  onVenueChange: (slugs: string[]) => void
  onBoatChange: (slugs: string[]) => void
  required?: boolean
}) {
  const pools = useQuery(api.directory.listByRole, { role: 'Pool' as StakeholderRole })
  const diveSites = useQuery(api.directory.listByRole, { role: 'DiveSite' as StakeholderRole })
  const boats = useQuery(api.directory.listByRole, { role: 'Boat' as StakeholderRole })

  const [typeFilter, setTypeFilter] = useState<VenueBoatFilter>('all')
  const [search, setSearch] = useState('')

  const allSlugs = useMemo(() => [...venueSlugs, ...boatSlugs], [venueSlugs, boatSlugs])

  const allEntries = useMemo(() => {
    if (pools === undefined || diveSites === undefined || boats === undefined) return undefined
    return [...(pools ?? []), ...(diveSites ?? []), ...(boats ?? [])]
  }, [pools, diveSites, boats])

  const filteredEntries = useMemo(() => {
    if (!allEntries) return []
    let result = allEntries.filter((e) => !allSlugs.includes(e.slug))
    if (typeFilter === 'venue') result = result.filter((e) => e.role !== 'Boat')
    if (typeFilter === 'boat') result = result.filter((e) => e.role === 'Boat')
    const trimmed = search.trim().toLowerCase()
    if (trimmed) result = result.filter((e) => e.name.toLowerCase().includes(trimmed) || e.placeName.toLowerCase().includes(trimmed))
    return result
  }, [allEntries, allSlugs, typeFilter, search])

  const handleChange = useCallback((slugs: string[]) => {
    if (!allEntries) return
    const entryBySlug = Object.fromEntries(allEntries.map((e) => [e.slug, e]))
    const nextVenues: string[] = []
    const nextBoats: string[] = []
    for (const s of slugs) {
      const e = entryBySlug[s]
      if (e?.role === 'Boat') nextBoats.push(s)
      else nextVenues.push(s)
    }
    onVenueChange(nextVenues)
    onBoatChange(nextBoats)
  }, [allEntries, onVenueChange, onBoatChange])

  const filterBar = (
    <div className="flex flex-wrap gap-1.5">
      <Chip label="All" active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} />
      <Chip label="Venue" active={typeFilter === 'venue'} onClick={() => setTypeFilter(typeFilter === 'venue' ? 'all' : 'venue')} />
      <Chip label="Boat" active={typeFilter === 'boat'} onClick={() => setTypeFilter(typeFilter === 'boat' ? 'all' : 'boat')} />
    </div>
  )

  return (
    <PreferredOverlayList
      slugs={allSlugs}
      onChange={handleChange}
      entries={allEntries}
      addButtonLabel="Add Venue or Boat"
      dialogTitle="Add Venue or Boat"
      maxItems={MAX_PREFERRED_VENUES + MAX_PREFERRED_BOATS}
      required={required}
      renderBadge={(e) => <VenueOrBoatBadge entry={e} />}
      filterBar={filterBar}
      filteredEntries={filteredEntries}
      search={search}
      onSearchChange={setSearch}
      onResetFilters={() => setTypeFilter('all')}
      noResultsText="No venues or boats match these filters."
      dndGroup="venues-boats"
    />
  )
}

function EquipmentBadge({ entry }: { entry: DirectoryEntry }) {
  const counts = entry.inventoryCounts
  if (!counts || Object.keys(counts).length === 0) return null
  const items = Object.entries(counts).sort(([, a], [, b]) => b - a)
  const shown = items.slice(0, 3)
  const remaining = items.length - 3
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map(([gt, count]) => (
        <Badge key={gt}>{GEAR_TYPE_LABELS[gt as GearType] ?? gt} x{count}</Badge>
      ))}
      {remaining > 0 && <Badge variant="muted" size="sm">+{remaining} more</Badge>}
    </div>
  )
}

export function PreferredEquipmentList(props: ListProps) {
  const { slugs, onChange } = props
  const entries = useQuery(api.directory.listByRole, { role: 'Equipment' as StakeholderRole })

  const [activeGearType, setActiveGearType] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filteredEntries = useMemo(() => {
    if (!entries) return []
    let result = entries.filter((e) => !slugs.includes(e.slug))
    if (activeGearType) result = result.filter((e) => (e.inventoryCounts?.[activeGearType] ?? 0) > 0)
    const trimmed = search.trim().toLowerCase()
    if (trimmed) result = result.filter((e) => e.name.toLowerCase().includes(trimmed) || e.placeName.toLowerCase().includes(trimmed))
    return result
  }, [entries, slugs, activeGearType, search])

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
      addButtonLabel="Add Equipment Provider"
      dialogTitle="Add Equipment Provider"
      maxItems={MAX_PREFERRED_EQUIPMENT}
      required={props.required}
      renderBadge={(e) => <EquipmentBadge entry={e} />}
      filterBar={filterBar}
      filteredEntries={filteredEntries}
      search={search}
      onSearchChange={setSearch}
      onResetFilters={() => setActiveGearType(null)}
      noResultsText="No equipment providers match these filters."
      dndGroup="equipment"
    />
  )
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

  const filteredEntries = useMemo(() => {
    if (!entries) return []
    let result = entries.filter((e) => !slugs.includes(e.slug))
    if (activeGasMix) result = result.filter((e) => (e.gasMixes ?? []).includes(activeGasMix))
    const trimmed = search.trim().toLowerCase()
    if (trimmed) result = result.filter((e) => e.name.toLowerCase().includes(trimmed) || e.placeName.toLowerCase().includes(trimmed))
    return result
  }, [entries, slugs, activeGasMix, search])

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
      addButtonLabel="Add Compressor"
      dialogTitle="Add Compressor"
      maxItems={MAX_PREFERRED_COMPRESSORS}
      renderBadge={(e) => <CompressorBadge entry={e} />}
      filterBar={filterBar}
      filteredEntries={filteredEntries}
      search={search}
      onSearchChange={setSearch}
      onResetFilters={() => setActiveGasMix(null)}
      noResultsText="No compressors match these filters."
      dndGroup="compressors"
    />
  )
}
