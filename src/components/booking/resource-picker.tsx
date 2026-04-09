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
  unavailableOwnerSlugs: Set<string>
  preferredSlugs?: string[]
  selectedSlug: string | undefined
  freeformName: string | undefined
  onSelectSlug: (slug: string | undefined) => void
  onFreeformChange: (name: string) => void
  isLoading?: boolean
  optional?: boolean
}

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
        <Input
          placeholder={`Enter ${label.toLowerCase()} name`}
          value={freeformName ?? ''}
          onChange={(e) => onFreeformChange(e.target.value)}
        />
      ) : isLoading ? (
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-theme text-secondary bg-glass-bg border border-glass-border"
        >
          <Spinner size="sm" />
          <span className="text-body">
            {t('loading')}
          </span>
        </div>
      ) : (
        <div className="relative">
          {/* design-ok */}<button
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

function SectionHeader({ label, topBorder }: { label: string; topBorder: boolean }) {
  return (
    <div
      className={`px-3 py-1 text-label font-semibold uppercase tracking-wide text-secondary${topBorder ? ' border-t border-glass-border' : ''}`}
    >
      {label}
    </div>
  )
}

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
  return ( /* design-ok */
    <button
      type="button"
      onClick={onSelect}
      disabled={isUnavailable}
      className="w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors duration-theme disabled:cursor-not-allowed glass-divider"
      style={{
        background: isSelected
          ? 'var(--color-primary-muted)'
          : 'transparent',
        opacity: isUnavailable ? 0.5 : 1,
      }}
    >
      <div className="flex-1 min-w-0">
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

        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-label truncate text-secondary">
            {entry.placeName}, {entry.country}
          </span>
        </div>

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
