'use client'

import React, { useState, useEffect, useRef, useId, useCallback, useMemo } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Search, Globe } from 'lucide-react'
import { GlassButton, GlassInput } from '@/components/glass'
import type { WizardAction, DiverEntry, DetailsState } from '@/lib/booking/wizard-state'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { COURSE_CATALOG } from '@/lib/constants/course-catalog'
import { COUNTRIES, getFlagEmoji, type Country } from '@/lib/constants/countries'
import { makeBookingDiversSchema } from '@/lib/validation/bookingSchemas'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiversStepProps {
  divers: DiverEntry[]
  details: DetailsState
  dispatch: React.Dispatch<WizardAction>
  onValidityChange?: (valid: boolean) => void
}

// ── Constants ────────────────────────────────────────────────────────────────

const AGENCIES = ['PADI', 'SSI', 'NAUI', 'BSAC', 'CMAS']

// Activities that require a pre-existing certification → show agency field
const CERTIFIED_CODES: CourseCode[] = [
  'FD', 'AOW', 'RESCUE', 'DM', 'SPECIALTY', 'REFRESH',
]

function shouldShowAgency(activityType: CourseCode[]): boolean {
  return activityType.some((c) => CERTIFIED_CODES.includes(c)) || activityType.includes('DSD')
}

function isDSDOnly(activityType: CourseCode[]): boolean {
  return activityType.includes('DSD') && !activityType.some((c) => CERTIFIED_CODES.includes(c))
}

// ── Name helpers ─────────────────────────────────────────────────────────────

function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim()
  if (!trimmed) return { firstName: '', lastName: '' }
  const parts = trimmed.split(' ')
  if (parts.length === 1) return { firstName: '', lastName: parts[0] }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}

function joinName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(' ')
}

function autoAbbrev(lastName: string, firstName: string): string {
  const base = lastName || firstName
  return base.slice(0, 3).toUpperCase()
}

// ── Country Combobox ──────────────────────────────────────────────────────────

interface CountryComboboxProps {
  value: { code: string; label: string }
  onChange: (country: Country) => void
}

function CountryCombobox({ value, onChange }: CountryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  const filtered = search.trim()
    ? COUNTRIES.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => searchInputRef.current?.focus(), 10)
  }, [open])

  function handleSelect(country: Country) {
    onChange(country)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <label
        htmlFor={id}
        className="block text-sm font-medium mb-1.5"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Nationality
      </label>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="glass w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left focus:outline-none focus-visible:ring-2"
        style={{
          color: value.code ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          outlineColor: 'var(--color-accent)',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-lg leading-none select-none" aria-hidden>
          {value.code ? getFlagEmoji(value.code) : <Globe size={16} />}
        </span>
        <span className="flex-1 truncate">
          {value.label || 'Select nationality\u2026'}
        </span>
        <ChevronDown
          size={14}
          className="flex-shrink-0 opacity-60"
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-[var(--border-radius)] shadow-xl overflow-hidden"
          style={{
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-glass-border)',
            backdropFilter: 'blur(var(--glass-blur))',
          }}
          role="listbox"
        >
          {/* Search input */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--color-glass-border)' }}>
            <div className="relative flex items-center">
              <Search
                size={14}
                className="absolute left-2.5 opacity-50 pointer-events-none"
                style={{ color: 'var(--color-text-secondary)' }}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search countries\u2026"
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-transparent focus:outline-none"
                style={{ color: 'var(--color-text-primary)' }}
              />
            </div>
          </div>

          {/* Options list */}
          <ul className="max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                No results
              </li>
            ) : (
              filtered.map((country) => {
                const isSelected = value.code === country.code
                return (
                  <li
                    key={country.code}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(country)}
                    className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer"
                    style={{
                      color: 'var(--color-text-primary)',
                      background: isSelected ? 'var(--color-glass-bg)' : undefined,
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background = 'var(--color-glass-bg)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background = isSelected
                        ? 'var(--color-glass-bg)'
                        : ''
                    }}
                  >
                    <span className="text-base leading-none select-none" aria-hidden>
                      {getFlagEmoji(country.code)}
                    </span>
                    <span className="flex-1 truncate">{country.label}</span>
                    <span className="ml-auto text-xs opacity-50">{country.code}</span>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Diver Row ─────────────────────────────────────────────────────────────────

interface DiverRowProps {
  index: number
  diver: DiverEntry
  bookingStartDate: string
  bookingEndDate: string
  dispatch: React.Dispatch<WizardAction>
  isOpen: boolean
  onToggle: () => void
  canRemove: boolean
  onRemove: () => void
}

function DiverRow({
  index,
  diver,
  bookingStartDate,
  bookingEndDate,
  dispatch,
  isOpen,
  onToggle,
  canRemove,
  onRemove,
}: DiverRowProps) {
  const { firstName: initFirst, lastName: initLast } = splitName(diver.name)
  const [firstName, setFirstName] = useState(initFirst)
  const [lastName, setLastName] = useState(initLast)

  function updateDiver(data: Partial<DiverEntry>) {
    dispatch({ type: 'UPDATE_DIVER', payload: { index, data } })
  }

  function commitFirstName(value: string) {
    const name = joinName(value, lastName)
    updateDiver({ name })
  }

  function commitLastName(value: string) {
    const name = joinName(firstName, value)
    // Only auto-update abbrev if it still matches the previously auto-generated value
    const prevAutoAbbrev = autoAbbrev(initLast, initFirst)
    const newAbbrev =
      !diver.abbrev || diver.abbrev === prevAutoAbbrev
        ? autoAbbrev(value, firstName)
        : diver.abbrev
    updateDiver({ name, abbrev: newAbbrev })
  }

  function handleActivityToggle(code: CourseCode) {
    const next = diver.activityType.includes(code)
      ? diver.activityType.filter((c) => c !== code)
      : [...diver.activityType, code]
    const updates: Partial<DiverEntry> = { activityType: next }
    // Auto-fill PADI for DSD-only; clear if no activities require agency
    if (isDSDOnly(next) && !diver.agency) updates.agency = 'PADI'
    if (!shouldShowAgency(next)) updates.agency = undefined
    updateDiver(updates)
  }

  // All unique course codes from catalog — each diver selects their own
  const availableActivities = COURSE_CATALOG.filter(
    (c, i, arr) => arr.findIndex((x) => x.code === c.code) === i,
  )

  const showAgency = shouldShowAgency(diver.activityType)
  const dsdOnly = isDSDOnly(diver.activityType)
  const headerFlag = diver.flag.code ? getFlagEmoji(diver.flag.code) : null
  const headerName = diver.name || `Diver ${index + 1}`

  return (
    <div
      className="rounded-[var(--border-radius)] overflow-hidden"
      style={{ border: '1px solid var(--color-glass-border)' }}
    >
      {/* Accordion header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: isOpen ? 'var(--color-glass-bg)' : 'transparent' }}
        aria-expanded={isOpen}
      >
        <span
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-primary)' }}
        >
          {index + 1}
        </span>

        <span className="flex-1 min-w-0">
          <span
            className="block text-sm font-medium truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {headerFlag && <span className="mr-1.5">{headerFlag}</span>}
            {headerName}
          </span>
          {diver.abbrev && (
            <span className="text-xs opacity-60" style={{ color: 'var(--color-text-secondary)' }}>
              {diver.abbrev}
            </span>
          )}
        </span>

        <span className="flex items-center gap-2">
          {canRemove && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  onRemove()
                }
              }}
              className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--color-destructive)', cursor: 'pointer' }}
              aria-label={`Remove diver ${index + 1}`}
            >
              <Trash2 size={14} />
            </span>
          )}
          {isOpen ? (
            <ChevronUp size={16} style={{ color: 'var(--color-text-secondary)' }} />
          ) : (
            <ChevronDown size={16} style={{ color: 'var(--color-text-secondary)' }} />
          )}
        </span>
      </button>

      {/* Accordion body */}
      {isOpen && (
        <div
          className="px-4 pb-4 pt-3 grid gap-4"
          style={{ borderTop: '1px solid var(--color-glass-border)' }}
        >
          {/* Name row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GlassInput
              label="First Name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={(e) => commitFirstName(e.target.value)}
              placeholder="e.g. John"
              autoComplete="given-name"
              required
            />
            <GlassInput
              label="Last Name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onBlur={(e) => commitLastName(e.target.value)}
              placeholder="e.g. Smith"
              autoComplete="family-name"
              required
            />
          </div>

          {/* Abbreviation + Flag row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GlassInput
              label="Abbreviation"
              type="text"
              value={diver.abbrev}
              onChange={(e) => updateDiver({ abbrev: e.target.value.slice(0, 5).toUpperCase() })}
              placeholder="Auto-generated"
              maxLength={5}
              helperText="Shown on manifests and schedules"
            />
            <CountryCombobox
              value={diver.flag}
              onChange={(c) => updateDiver({ flag: { code: c.code, label: c.label } })}
            />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GlassInput
              label="Start Date"
              type="date"
              value={diver.startDate}
              onChange={(e) => updateDiver({ startDate: e.target.value })}
              min={bookingStartDate}
              max={bookingEndDate}
              required
            />
            <GlassInput
              label="End Date"
              type="date"
              value={diver.endDate}
              onChange={(e) => updateDiver({ endDate: e.target.value })}
              min={diver.startDate || bookingStartDate}
              max={bookingEndDate}
              required
            />
          </div>

          {/* Per-diver activity types */}
          {availableActivities.length > 0 && (
            <div>
              <p
                className="text-sm font-medium mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Activities
              </p>
              <div className="flex flex-wrap gap-2">
                {availableActivities.map((activity) => {
                  const active = diver.activityType.includes(activity.code)
                  return (
                    <button
                      key={activity.code}
                      type="button"
                      onClick={() => handleActivityToggle(activity.code)}
                      className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                      style={{
                        background: active ? 'var(--color-primary)' : 'transparent',
                        color: active
                          ? 'var(--color-text-on-primary)'
                          : 'var(--color-text-secondary)',
                        borderColor: active ? 'var(--color-primary)' : 'var(--color-glass-border)',
                      }}
                    >
                      {activity.code}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Agency — conditional on activity types */}
          {showAgency && (
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {dsdOnly ? 'Certification Agency' : 'Certification Agency (optional)'}
              </label>
              <select
                value={diver.agency ?? ''}
                onChange={(e) => updateDiver({ agency: e.target.value || undefined })}
                disabled={dsdOnly}
                className="glass w-full px-3 py-2.5 text-sm focus:outline-none focus-visible:ring-2 disabled:opacity-60"
                style={{
                  color: diver.agency ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  outlineColor: 'var(--color-accent)',
                }}
              >
                <option value="">{dsdOnly ? 'PADI (auto)' : 'Select agency\u2026'}</option>
                {AGENCIES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Step Divers ───────────────────────────────────────────────────────────────

export function StepDivers({ divers, details, dispatch, onValidityChange }: DiversStepProps) {
  const [openIndex, setOpenIndex] = useState<number>(0)

  // Stable schema derived from booking-level details
  const diversSchema = useMemo(
    () => makeBookingDiversSchema(details.activityType, details.startDate, details.endDate),
    [details.activityType, details.startDate, details.endDate],
  )

  // Notify parent when validity changes
  useEffect(() => {
    if (!onValidityChange) return
    onValidityChange(diversSchema.safeParse(divers).success)
  }, [divers, diversSchema, onValidityChange])

  // Stable per-diver keys to prevent incorrect local-state reuse when rows shift
  const [diverKeys, setDiverKeys] = useState<string[]>(() =>
    Array.from({ length: divers.length }, (_, i) => `dk-init-${i}`),
  )

  // Seed one diver on first render if the list is empty
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current || divers.length > 0) {
      seededRef.current = true
      return
    }
    seededRef.current = true
    setDiverKeys(['dk-seed-0'])
    dispatch({
      type: 'ADD_DIVER',
      payload: {
        name: '',
        abbrev: '',
        flag: { code: '', label: '' },
        startDate: details.startDate,
        endDate: details.endDate,
        agency: undefined,
        activityType: [],
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentional: seed runs once on mount only

  const handleAddDiver = useCallback(() => {
    const key = `dk-add-${Date.now()}`
    setDiverKeys((prev) => [...prev, key])
    // Default to first diver's activity type — operator can change per diver
    const firstDiverActivityType = divers.length > 0 ? divers[0].activityType : []
    const autoFill = firstDiverActivityType.includes('DSD') ? 'PADI' : undefined
    dispatch({
      type: 'ADD_DIVER',
      payload: {
        name: '',
        abbrev: '',
        flag: { code: '', label: '' },
        startDate: details.startDate,
        endDate: details.endDate,
        agency: autoFill,
        activityType: [...firstDiverActivityType],
      },
    })
    setOpenIndex(divers.length)
  }, [dispatch, details, divers])

  const handleRemoveDiver = useCallback(
    (index: number) => {
      setDiverKeys((prev) => prev.filter((_, i) => i !== index))
      dispatch({ type: 'REMOVE_DIVER', payload: index })
      setOpenIndex((prev) => {
        if (prev === index) return Math.max(0, index - 1)
        if (prev > index) return prev - 1
        return prev
      })
    },
    [dispatch],
  )

  function toggleRow(index: number) {
    setOpenIndex((prev) => (prev === index ? -1 : index))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3
            className="text-base font-semibold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            Divers
          </h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {divers.length} diver{divers.length !== 1 ? 's' : ''} added
          </p>
        </div>
        <GlassButton variant="secondary" size="sm" onClick={handleAddDiver}>
          <Plus size={14} />
          Add Diver
        </GlassButton>
      </div>

      {/* Diver rows */}
      <div className="space-y-2">
        {divers.map((diver, index) => (
          <DiverRow
            key={diverKeys[index] ?? `dk-fallback-${index}`}
            index={index}
            diver={diver}
            bookingStartDate={details.startDate}
            bookingEndDate={details.endDate}
            dispatch={dispatch}
            isOpen={openIndex === index}
            onToggle={() => toggleRow(index)}
            canRemove={divers.length > 1}
            onRemove={() => handleRemoveDiver(index)}
          />
        ))}
      </div>

      {divers.length === 0 && (
        <div
          className="text-center py-8 rounded-[var(--border-radius)] border border-dashed"
          style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-text-secondary)' }}
        >
          <p className="text-sm">No divers added yet.</p>
        </div>
      )}
    </div>
  )
}
