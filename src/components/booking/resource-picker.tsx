'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronDown } from 'lucide-react'
import { Button, Input, Badge } from '@/components/ui'
import { Spinner } from '@/components/ui/spinner'
import type { ResourcePickerEntry } from '@/lib/types/booking'

export type { ResourcePickerEntry }

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
  const t = useTranslations('common')
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
  const prefSet = useMemo(() => new Set(preferredSlugs ?? []), [preferredSlugs])

  const preferredAvailable = useMemo(
    () => (preferredSlugs ?? [])
      .map((slug) => entries.find((e) => e.slug === slug))
      .filter((e): e is ResourcePickerEntry => !!e && !unavailableOwnerSlugs.has(e.slug)),
    [preferredSlugs, entries, unavailableOwnerSlugs],
  )
  const preferredUnavailable = useMemo(
    () => (preferredSlugs ?? [])
      .map((slug) => entries.find((e) => e.slug === slug))
      .filter((e): e is ResourcePickerEntry => !!e && unavailableOwnerSlugs.has(e.slug)),
    [preferredSlugs, entries, unavailableOwnerSlugs],
  )

  const availableEntries = useMemo(
    () => entries.filter((e) => !unavailableOwnerSlugs.has(e.slug) && (!hasPref || !prefSet.has(e.slug))),
    [entries, unavailableOwnerSlugs, hasPref, prefSet],
  )
  const unavailableEntries = useMemo(
    () => entries.filter((e) => unavailableOwnerSlugs.has(e.slug) && (!hasPref || !prefSet.has(e.slug))),
    [entries, unavailableOwnerSlugs, hasPref, prefSet],
  )

  return (
    <div className="flex flex-col gap-2">
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-body font-medium text-secondary">
          {label}
          {optional && (
            <span className="ml-1 text-label font-normal opacity-60">(optional)</span>
          )}
        </span>
        <Button variant="ghost" size="sm" onClick={toggleExternal} type="button">
          {isExternal ? 'In system' : 'Not in system'}
        </Button>
      </div>

      {isExternal ? (
        /* Freeform name input */
        <Input
          placeholder={`Enter ${label.toLowerCase()} name`}
          value={freeformName ?? ''}
          onChange={(e) => onFreeformChange(e.target.value)}
        />
      ) : isLoading ? (
        /* Loading skeleton */
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-theme text-secondary bg-glass-bg border border-glass-border"
        >
          <Spinner size="sm" />
          <span className="text-body">
            {t('loading')}
          </span>
        </div>
      ) : (
        /* Dropdown trigger */
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen((o) => !o)}
            className="w-full text-left px-3 py-2.5 text-body rounded-theme flex items-center justify-between gap-2 transition-opacity duration-theme hover:opacity-90"
            style={{
              background: 'var(--color-glass-bg)',
              border: '1px solid var(--color-glass-border)',
              color: selectedEntry ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            }}
          >
            <span className="truncate">
              {selectedEntry ? selectedEntry.name : `Select ${label.toLowerCase()}…`}
            </span>
            <ChevronDown
              size={14}
              className="flex-shrink-0 transition-transform duration-theme text-secondary"
              style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>

          {isOpen && (
            /* Dropdown list */
            <div
              className="absolute z-[var(--z-dropdown)] left-0 right-0 top-full mt-1 rounded-theme shadow-xl overflow-hidden"
              style={{
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-glass-border)',
                maxHeight: '18rem',
                overflowY: 'auto',
              }}
            >
              {entries.length === 0 ? (
                <div
                  className="px-3 py-4 text-body text-center text-secondary"
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
          className="flex items-center gap-2 flex-wrap px-3 py-1.5 rounded-[var(--border-radius-button)] bg-glass-bg border border-glass-border"
        >
          <span className="text-label text-secondary">
            {selectedEntry.placeName}, {selectedEntry.country}
          </span>
          {selectedEntry.verified && (
            <Badge variant="success" size="sm" dot>
              Verified
            </Badge>
          )}
          {selectedEntry.subItems?.map((item) => (
            <Badge key={item} variant="info" size="sm">
              {item}
            </Badge>
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
      className="px-3 py-1 text-label font-semibold uppercase tracking-wide text-secondary"
      style={{ borderTop: topBorder ? '1px solid var(--color-glass-border)' : undefined }}
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
      className="w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors duration-theme disabled:cursor-not-allowed"
      style={{
        background: isSelected
          ? 'var(--color-primary-muted)'
          : 'transparent',
        opacity: isUnavailable ? 0.5 : 1,
        borderBottom: '1px solid var(--color-glass-border)',
      }}
    >
      <div className="flex-1 min-w-0">
        {/* Name + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-body font-medium truncate text-primary"
          >
            {entry.name}
          </span>
          {entry.verified && (
            <Badge variant="success" size="sm">
              Verified
            </Badge>
          )}
          {isUnavailable && (
            <Badge variant="destructive" size="sm">
              {unavailableLabel}
            </Badge>
          )}
        </div>

        {/* Location + languages */}
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-label truncate text-secondary">
            {entry.placeName}, {entry.country}
          </span>
        </div>

        {/* Sub-items (vessel names, pool names, etc.) */}
        {entry.subItems && entry.subItems.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {entry.subItems.map((item) => (
              <Badge key={item} variant="info" size="sm">
                {item}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {isSelected && (
        <Check
          size={14}
          className="flex-shrink-0 mt-0.5 text-primary"
        />
      )}
    </button>
  )
}
