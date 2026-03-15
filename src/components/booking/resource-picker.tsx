'use client'

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { GlassButton, GlassInput, GlassBadge } from '@/components/glass'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResourcePickerEntry {
  slug: string
  name: string
  city: string
  country: string
  languages: string[]
  verified: boolean
  /** Boat vessel names, pool names, etc. — shown as info badges */
  subItems?: string[]
}

interface ResourcePickerProps {
  label: string
  entries: ResourcePickerEntry[]
  /** Slugs whose inventory units are all fully booked on the booking dates */
  unavailableOwnerSlugs: Set<string>
  /** Operator's preferred slugs in ranked order — renders a Preferred section */
  preferredSlugs?: string[]
  selectedSlug: string | undefined
  freeformName: string | undefined
  onSelectSlug: (slug: string | undefined) => void
  onFreeformChange: (name: string) => void
  isLoading?: boolean
  optional?: boolean
}

// ── ResourcePicker ─────────────────────────────────────────────────────────────

export function ResourcePicker({
  label,
  entries,
  unavailableOwnerSlugs,
  preferredSlugs,
  selectedSlug,
  freeformName,
  onSelectSlug,
  onFreeformChange,
  isLoading = false,
  optional = false,
}: ResourcePickerProps) {
  // Derive initial mode from whether a freeform name is already set
  const [isExternal, setIsExternal] = useState(() => !!freeformName)
  const [isOpen, setIsOpen] = useState(false)

  function toggleExternal() {
    const next = !isExternal
    setIsExternal(next)
    setIsOpen(false)
    if (next) {
      onSelectSlug(undefined)
    } else {
      onFreeformChange('')
    }
  }

  const selectedEntry = entries.find((e) => e.slug === selectedSlug)

  // ── Preferred grouping ──────────────────────────────────────────────────
  const hasPref = (preferredSlugs?.length ?? 0) > 0
  const prefSet = new Set(preferredSlugs ?? [])

  // Preferred entries in exact preference order (filter to those in entries)
  const preferredAvailable = (preferredSlugs ?? [])
    .map((slug) => entries.find((e) => e.slug === slug))
    .filter((e): e is ResourcePickerEntry => !!e && !unavailableOwnerSlugs.has(e.slug))
  const preferredUnavailable = (preferredSlugs ?? [])
    .map((slug) => entries.find((e) => e.slug === slug))
    .filter((e): e is ResourcePickerEntry => !!e && unavailableOwnerSlugs.has(e.slug))

  // Non-preferred entries (already sorted by step-resources when preferredSlugs is set)
  const availableEntries = entries.filter((e) => !unavailableOwnerSlugs.has(e.slug) && (!hasPref || !prefSet.has(e.slug)))
  const unavailableEntries = entries.filter((e) => unavailableOwnerSlugs.has(e.slug) && (!hasPref || !prefSet.has(e.slug)))

  return (
    <div className="flex flex-col gap-2">
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
          {optional && (
            <span className="ml-1 text-xs font-normal opacity-60">(optional)</span>
          )}
        </span>
        <GlassButton variant="ghost" size="sm" onClick={toggleExternal} type="button">
          {isExternal ? 'In system' : 'Not in system'}
        </GlassButton>
      </div>

      {isExternal ? (
        /* Freeform name input */
        <GlassInput
          placeholder={`Enter ${label.toLowerCase()} name`}
          value={freeformName ?? ''}
          onChange={(e) => onFreeformChange(e.target.value)}
        />
      ) : isLoading ? (
        /* Loading skeleton */
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
          style={{
            background: 'var(--color-glass-bg)',
            border: '1px solid var(--color-glass-border)',
          }}
        >
          <span
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0"
            style={{ color: 'var(--color-text-secondary)' }}
          />
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Loading…
          </span>
        </div>
      ) : (
        /* Dropdown trigger */
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen((o) => !o)}
            className="w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center justify-between gap-2 transition-opacity hover:opacity-90"
            style={{
              background: 'var(--color-glass-bg)',
              border: '1px solid var(--color-glass-border)',
              color: selectedEntry ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
            }}
          >
            <span className="truncate">
              {selectedEntry ? selectedEntry.name : `Select ${label.toLowerCase()}…`}
            </span>
            <ChevronDown
              size={14}
              className="flex-shrink-0 transition-transform"
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                color: 'var(--color-text-secondary)',
              }}
            />
          </button>

          {isOpen && (
            /* Dropdown list */
            <div
              className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg shadow-xl overflow-hidden"
              style={{
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-glass-border)',
                backdropFilter: 'blur(var(--glass-blur))',
                WebkitBackdropFilter: 'blur(var(--glass-blur))',
                maxHeight: '18rem',
                overflowY: 'auto',
              }}
            >
              {entries.length === 0 ? (
                <div
                  className="px-3 py-4 text-sm text-center"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  No {label.toLowerCase()}s found nearby
                </div>
              ) : (
                <>
                  {/* Preferred section */}
                  {hasPref && (preferredAvailable.length > 0 || preferredUnavailable.length > 0) && (
                    <>
                      <SectionHeader label="Preferred" topBorder={false} />
                      {preferredAvailable.map((entry) => (
                        <PickerRow
                          key={entry.slug}
                          entry={entry}
                          isSelected={selectedSlug === entry.slug}
                          isUnavailable={false}
                          onSelect={() => {
                            onSelectSlug(entry.slug)
                            setIsOpen(false)
                          }}
                        />
                      ))}
                      {preferredUnavailable.map((entry) => (
                        <PickerRow
                          key={entry.slug}
                          entry={entry}
                          isSelected={false}
                          isUnavailable={true}
                          unavailableLabel="Unavailable"
                          onSelect={() => {}}
                        />
                      ))}
                    </>
                  )}

                  {/* Other available entries */}
                  {availableEntries.length > 0 && (
                    <>
                      {hasPref && (preferredAvailable.length > 0 || preferredUnavailable.length > 0) && (
                        <SectionHeader label="Other" topBorder />
                      )}
                      {availableEntries.map((entry) => (
                        <PickerRow
                          key={entry.slug}
                          entry={entry}
                          isSelected={selectedSlug === entry.slug}
                          isUnavailable={false}
                          onSelect={() => {
                            onSelectSlug(entry.slug)
                            setIsOpen(false)
                          }}
                        />
                      ))}
                    </>
                  )}

                  {/* Fully booked non-preferred */}
                  {unavailableEntries.length > 0 && (
                    <>
                      <SectionHeader label="Fully booked" topBorder />
                      {unavailableEntries.map((entry) => (
                        <PickerRow
                          key={entry.slug}
                          entry={entry}
                          isSelected={false}
                          isUnavailable={true}
                          onSelect={() => {}}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Selected entry detail strip */}
      {!isExternal && selectedEntry && (
        <div
          className="flex items-center gap-2 flex-wrap px-3 py-1.5 rounded-md"
          style={{ background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)' }}
        >
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {selectedEntry.city}, {selectedEntry.country}
          </span>
          {selectedEntry.verified && (
            <GlassBadge variant="success" size="sm" dot>
              Verified
            </GlassBadge>
          )}
          {selectedEntry.languages.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {selectedEntry.languages.slice(0, 3).join(' · ')}
            </span>
          )}
          {selectedEntry.subItems?.map((item) => (
            <GlassBadge key={item} variant="info" size="sm">
              {item}
            </GlassBadge>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SectionHeader ──────────────────────────────────────────────────────────────

function SectionHeader({ label, topBorder }: { label: string; topBorder: boolean }) {
  return (
    <div
      className="px-3 py-1 text-xs font-semibold uppercase tracking-wider"
      style={{
        color: 'var(--color-text-secondary)',
        borderTop: topBorder ? '1px solid var(--color-glass-border)' : undefined,
      }}
    >
      {label}
    </div>
  )
}

// ── PickerRow ──────────────────────────────────────────────────────────────────

function PickerRow({
  entry,
  isSelected,
  isUnavailable,
  unavailableLabel = 'Booked',
  onSelect,
}: {
  entry: ResourcePickerEntry
  isSelected: boolean
  isUnavailable: boolean
  unavailableLabel?: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isUnavailable}
      className="w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors disabled:cursor-not-allowed"
      style={{
        background: isSelected
          ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
          : 'transparent',
        opacity: isUnavailable ? 0.5 : 1,
        borderBottom: '1px solid var(--color-glass-border)',
      }}
    >
      <div className="flex-1 min-w-0">
        {/* Name + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-medium truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {entry.name}
          </span>
          {entry.verified && (
            <GlassBadge variant="success" size="sm">
              Verified
            </GlassBadge>
          )}
          {isUnavailable && (
            <GlassBadge variant="destructive" size="sm">
              {unavailableLabel}
            </GlassBadge>
          )}
        </div>

        {/* Location + languages */}
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
            {entry.city}, {entry.country}
          </span>
          {entry.languages.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              · {entry.languages.slice(0, 2).join(', ')}
            </span>
          )}
        </div>

        {/* Sub-items (vessel names, pool names, etc.) */}
        {entry.subItems && entry.subItems.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {entry.subItems.map((item) => (
              <GlassBadge key={item} variant="info" size="sm">
                {item}
              </GlassBadge>
            ))}
          </div>
        )}
      </div>

      {isSelected && (
        <Check
          size={14}
          className="flex-shrink-0 mt-0.5"
          style={{ color: 'var(--color-primary)' }}
        />
      )}
    </button>
  )
}
