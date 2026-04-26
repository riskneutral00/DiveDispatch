'use client'

import { useState, useMemo, useCallback, type ReactNode } from 'react'
import { useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Trash2, Plus, GripVertical, Wind } from 'lucide-react'
import { DragDropProvider } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { api } from '@/lib/convex-generated'
import type { DirectoryEntry } from '../../../convex/directory'
import { useDirectoryByRoleKey } from '@/lib/hooks/use-directory-by-role-key'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { BOAT_TYPE_LABELS } from '@/lib/constants/boat-types'
import { GAS_MIXES, GAS_MIX_LABELS } from '@/lib/constants/gas-mixes'
import { GEAR_TYPES, GEAR_TYPE_LABELS, type GearType } from '@/lib/constants/gear-sizing'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { SortableOverlayList } from '@/components/ui/sortable-overlay-list'
import { LanguagePicker, type Language } from '@/components/profiles/language-picker'
import { InstructorCardContent } from '@/components/profiles/instructor-card'
import { ALL_LANGUAGES } from '@/lib/constants/dive-languages'

// query-budget-ok: 6 subscriptions; planned migration to preferred.listContext (Phase 2D of zesty-creek perf plan)

function defaultCandidateRender(entry: DirectoryEntry, badge: ReactNode) {
  return (
    <>
      <span className="font-medium">{entry.name}</span>
      <span className="ml-2 text-label text-secondary">{entry.placeName}</span>
      <div className="mt-0.5">{badge}</div>
    </>
  )
}

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
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button /* design-ok: chip control */
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
}: FilterBarProps) {
  return (
    <div className="space-y-2">

      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-label text-secondary mr-1">Agency</span>
        {agencies.map((agency) => {
          const isActive = activeAgency === agency
          return (
            <Chip
              key={agency}
              label={agency}
              active={isActive}
              onClick={() => onAgencyChange(isActive ? null : agency)}
            />
          )
        })}
        <span className="ml-auto text-label text-secondary">
          {currentCount}/{MAX_PREFERRED_INSTRUCTORS}
        </span>
      </div>

      {activeAgency && specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-label text-secondary mr-1">Specialties</span>
          {specialties.map((spec) => {
            const isActive = activeSpecialties.has(spec)
            return (
              <Chip
                key={spec}
                label={spec}
                active={isActive}
                onClick={() => onSpecialtyToggle(spec)}
              />
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
        <div className="mt-2.5 glass-divider" />
      )}
    </div>
  )
}

function SortableInstructorCard({
  slug,
  index,
  entry,
  onRemove,
}: {
  slug: string
  index: number
  entry: DirectoryEntry | undefined
  onRemove: () => void
}) {
  const { ref, handleRef, isDragging } = useSortable({ id: slug, index, group: 'instructors' })

  return (
    <div
      ref={ref}
      className="glass-container reading-plane rounded-theme p-3 min-w-[140px]"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="flex items-start gap-1 mb-1">
        <span className="text-label font-bold w-5 text-center shrink-0 text-secondary">{index + 1}</span>
        <button /* design-ok: DnD handle requires raw button for drag listeners */
          ref={handleRef}
          type="button"
          className="shrink-0 cursor-grab active:cursor-grabbing text-secondary hover:text-primary transition-colors duration-theme"
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
      </div>

      <InstructorCardContent
        entry={entry}
        slug={slug}
        layout="card"
        action={
          <Button
            variant="destructive-ghost"
            size="sm"
            type="button"
            onClick={onRemove}
            aria-label="Remove instructor"
            className="shrink-0"
          >
            <Trash2 size={14} />
          </Button>
        }
      />
    </div>
  )
}

export function PreferredInstructorList(props: ListProps) {
  const { slugs, onChange } = props
  const tDialogs = useTranslations('booking.dialogs')
  const tEmpty = useTranslations('booking.emptyStates')

  const entries = useDirectoryByRoleKey('instructor')
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
          for (const rating of c.specialtyRatings ?? []) {
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
          c.agency === agency && [...activeSpecialties].every((s) => c.specialtyRatings?.includes(s))
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"> {/* design-ok: preferred-instructor card grid, mobile baseline 2-col is intentional density for drag-reorder UX */}
            {slugs.map((slug, index) => (
              <SortableInstructorCard
                key={slug}
                slug={slug}
                index={index}
                entry={slugToEntry[slug]}
                onRemove={() => remove(index)}
              />
            ))}
          </div>
        </DragDropProvider>
      )}

      <Dialog
        open={showOverlay}
        onClose={closeOverlay}
        title={tDialogs('addInstructorTitle')}
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
          />

          <Input
            label="Search instructors"
            placeholder="Search by name or city..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          />

          <div
            className="rounded-theme overflow-hidden flex flex-col glass-elevated bg-surface-elevated"
            style={{
              minHeight: OVERLAY_LIST_HEIGHT,
              maxHeight: OVERLAY_LIST_HEIGHT,
            }}
          >
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
                <EmptyState message={tEmpty('noInstructorsMatch')} />
              )}
            </div>
            {totalPages > 1 && (
              <div
                className="flex items-center justify-between px-3 py-2 shrink-0 border-t border-glass-border"
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



function VenueBadge({ entry }: { entry: DirectoryEntry }) {
  const subtype = entry.kind
  const label = subtype
    ? subtype.charAt(0).toUpperCase() + subtype.slice(1)
    : null
  return (
    <div className="flex flex-wrap items-center gap-1">
      {label && <Badge variant="muted" size="sm">{label}</Badge>}
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

export function PreferredVenueList(props: ListProps) {
  const { slugs, onChange } = props
  const entries = useDirectoryByRoleKey('venue')

  const [search, setSearch] = useState('')

  const filteredEntries = useMemo(() => {
    if (!entries) return []
    let result = entries.filter((e) => !slugs.includes(e.slug))
    const trimmed = search.trim().toLowerCase()
    if (trimmed) result = result.filter((e) => e.name.toLowerCase().includes(trimmed) || e.placeName.toLowerCase().includes(trimmed))
    return result
  }, [entries, slugs, search])

  return (
    <SortableOverlayList
      slugs={slugs}
      onChange={onChange}
      entries={entries}
      addButtonLabel="Add Venue"
      dialogTitle="Add Venue"
      searchLabel="Search venues"
      searchPlaceholder="Search by name or city..."
      noResultsText="No venues match these filters."
      removeAriaLabel="Remove"
      previousPageAriaLabel="Previous page"
      nextPageAriaLabel="Next page"
      maxItems={MAX_PREFERRED_VENUES}
      renderBadge={(e) => <VenueBadge entry={e} />}
      renderCandidate={(e) => defaultCandidateRender(e, <VenueBadge entry={e} />)}
      filteredEntries={filteredEntries}
      search={search}
      onSearchChange={setSearch}
      dndGroup="venues"
    />
  )
}

export function PreferredBoatList(props: ListProps) {
  const { slugs, onChange } = props
  const entries = useDirectoryByRoleKey('boat')

  const [search, setSearch] = useState('')

  const filteredEntries = useMemo(() => {
    if (!entries) return []
    let result = entries.filter((e) => !slugs.includes(e.slug))
    const trimmed = search.trim().toLowerCase()
    if (trimmed) result = result.filter((e) => e.name.toLowerCase().includes(trimmed) || e.placeName.toLowerCase().includes(trimmed))
    return result
  }, [entries, slugs, search])

  return (
    <SortableOverlayList
      slugs={slugs}
      onChange={onChange}
      entries={entries}
      addButtonLabel="Add Boat"
      dialogTitle="Add Boat"
      searchLabel="Search boats"
      searchPlaceholder="Search by name or city..."
      noResultsText="No boats match these filters."
      removeAriaLabel="Remove"
      previousPageAriaLabel="Previous page"
      nextPageAriaLabel="Next page"
      maxItems={MAX_PREFERRED_BOATS}
      renderBadge={(e) => <BoatBadge entry={e} />}
      renderCandidate={(e) => defaultCandidateRender(e, <BoatBadge entry={e} />)}
      filteredEntries={filteredEntries}
      search={search}
      onSearchChange={setSearch}
      dndGroup="boats"
    />
  )
}


function EquipmentBadge({ entry }: { entry: DirectoryEntry }) {
  const items = Object.entries(entry.inventoryCounts ?? {})
    .filter(([, count]) => (count as number) > 0)
    .sort(([, a], [, b]) => (b as number) - (a as number))
  if (items.length === 0) return null
  const MAX_VISIBLE = 3
  const shown = items.slice(0, MAX_VISIBLE)
  const overflow = items.slice(MAX_VISIBLE)
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map(([gt, count]) => (
        <Badge key={gt} variant="muted" size="sm">{GEAR_TYPE_LABELS[gt as GearType] ?? gt} x{count as number}</Badge>
      ))}
      {overflow.length > 0 && (
        <Tooltip label={overflow.map(([gt, count]) => `${GEAR_TYPE_LABELS[gt as GearType] ?? gt} x${count as number}`).join(', ')}>
          <Badge variant="muted" size="sm">+{overflow.length} more</Badge>
        </Tooltip>
      )}
    </div>
  )
}

export function PreferredEquipmentList(props: ListProps) {
  const { slugs, onChange } = props
  const entries = useDirectoryByRoleKey('equipment')

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
    <SortableOverlayList
      slugs={slugs}
      onChange={onChange}
      entries={entries}
      addButtonLabel="Add Equipment Provider"
      dialogTitle="Add Equipment Provider"
      searchLabel="Search equipment providers"
      searchPlaceholder="Search by name or city..."
      noResultsText="No equipment providers match these filters."
      removeAriaLabel="Remove"
      previousPageAriaLabel="Previous page"
      nextPageAriaLabel="Next page"
      maxItems={MAX_PREFERRED_EQUIPMENT}
      renderBadge={(e) => <EquipmentBadge entry={e} />}
      renderCandidate={(e) => defaultCandidateRender(e, <EquipmentBadge entry={e} />)}
      filterBar={filterBar}
      filteredEntries={filteredEntries}
      search={search}
      onSearchChange={setSearch}
      onResetFilters={() => setActiveGearType(null)}
      dndGroup="equipment"
    />
  )
}

function CompressorBadge({ entry }: { entry: DirectoryEntry }) {
  const mixes = entry.gasMixes ?? []
  if (mixes.length === 0) return null
  const MAX_VISIBLE = 3
  const shown = mixes.slice(0, MAX_VISIBLE)
  const overflow = mixes.slice(MAX_VISIBLE)
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((m) => (
        <Badge key={m}>{GAS_MIX_LABELS[m] ?? m}</Badge>
      ))}
      {overflow.length > 0 && (
        <Tooltip label={overflow.map(m => GAS_MIX_LABELS[m] ?? m).join(', ')}>
          <Badge>+{overflow.length}</Badge>
        </Tooltip>
      )}
    </div>
  )
}

export function PreferredCompressorList(props: ListProps) {
  const { slugs, onChange } = props
  const entries = useDirectoryByRoleKey('compressor')

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
    <SortableOverlayList
      slugs={slugs}
      onChange={onChange}
      entries={entries}
      addButtonLabel="Add Compressor"
      dialogTitle="Add Compressor"
      searchLabel="Search compressors"
      searchPlaceholder="Search by name or city..."
      noResultsText="No compressors match these filters."
      removeAriaLabel="Remove"
      previousPageAriaLabel="Previous page"
      nextPageAriaLabel="Next page"
      maxItems={MAX_PREFERRED_COMPRESSORS}
      renderBadge={(e) => <CompressorBadge entry={e} />}
      renderCandidate={(e) => defaultCandidateRender(e, <CompressorBadge entry={e} />)}
      filterBar={filterBar}
      filteredEntries={filteredEntries}
      search={search}
      onSearchChange={setSearch}
      onResetFilters={() => setActiveGasMix(null)}
      dndGroup="compressors"
    />
  )
}
