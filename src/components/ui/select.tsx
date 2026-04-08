'use client'

import { useState, useRef, useEffect, useCallback, useId, useMemo, memo } from 'react'
import { ChevronDown, ChevronRight, Check } from 'lucide-react'
import { FieldShell } from '@/components/ui/field-shell'
import { useFloatingLabel } from '@/lib/hooks/use-floating-label'
import { cn } from '@/lib/utils/cn'
import { LanguageFlags } from '@/components/profiles/language-flags'
import { splitInstructorTiers } from '@/lib/booking/instructor-tiers'
import { scoreLanguageMatch, type MatchTier } from '@/lib/utils/language-matching'

export interface SelectOption {
  id: string
  label: string
  languages?: string[]
  isPreferred?: boolean
}

interface SelectProps {
  label?: string
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  customerLanguages?: string[]
  'data-testid'?: string
  required?: boolean
  error?: string
  helperText?: string
}

const DEFAULT_VISIBLE = 2

const MATCH_BADGE: Record<MatchTier, { label: string; color: string } | null> = {
  full: { label: 'Full match', color: 'var(--color-success)' },
  partial: { label: 'Partial', color: 'var(--color-warning)' },
  none: null,
}

const OptionRow = memo(function OptionRow({
  opt,
  isSelected,
  isFocused,
  onSelect,
  onHover,
  id,
  matchTier,
}: {
  opt: SelectOption
  isSelected: boolean
  isFocused: boolean
  onSelect: () => void
  onHover: () => void
  id: string
  matchTier?: MatchTier
}) {
  const badge = matchTier ? MATCH_BADGE[matchTier] : null
  return (
    <li
      id={id}
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      onMouseEnter={onHover}
      className="flex items-center justify-between gap-2 px-3 py-2 text-body cursor-pointer transition-colors duration-theme text-primary"
      style={{ background: isFocused ? 'var(--color-accent-muted)' : 'transparent' }}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className="w-3.5 flex-shrink-0">
          {isSelected && <Check size={14} className="text-accent" />}
        </span>
        <span className="truncate">{opt.label}</span>
        {badge && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0" /* design-ok */
            style={{ color: badge.color, backgroundColor: `color-mix(in srgb, ${badge.color} 15%, transparent)` }}
          >
            {badge.label}
          </span>
        )}
      </span>
      {opt.languages && opt.languages.length > 0 && (
        <LanguageFlags languages={opt.languages} className="text-body flex-shrink-0" />
      )}
    </li>
  )
})

function TierSection({
  title,
  items,
  defaultOpen,
  value,
  onSelect,
  idPrefix,
  globalIdxOffset,
  focusedIdx,
  setFocusedIdx,
  customerLanguages,
}: {
  title: string
  items: SelectOption[]
  defaultOpen: boolean
  value: string
  onSelect: (id: string) => void
  idPrefix: string
  globalIdxOffset: number
  focusedIdx: number
  setFocusedIdx: (idx: number) => void
  customerLanguages?: string[]
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [showAll, setShowAll] = useState(false)

  const tierMap = useMemo(() => {
    if (!customerLanguages?.length) return null
    return new Map(items.map(opt => [opt.id, scoreLanguageMatch(opt.languages ?? [], customerLanguages).tier]))
  }, [items, customerLanguages])

  if (items.length === 0) return null

  const visibleItems = showAll ? items : items.slice(0, DEFAULT_VISIBLE)
  const hiddenCount = items.length - DEFAULT_VISIBLE

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-secondary font-heading" /* design-ok */
      >
        {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {title} ({items.length})
      </button>
      {isOpen && (
        <>
          {visibleItems.map((opt, i) => {
            const globalIdx = globalIdxOffset + i
            return (
              <OptionRow
                key={opt.id}
                opt={opt}
                isSelected={opt.id === value}
                isFocused={globalIdx === focusedIdx}
                onSelect={() => onSelect(opt.id)}
                onHover={() => setFocusedIdx(globalIdx)}
                id={`${idPrefix}-opt-${globalIdx}`}
                matchTier={tierMap?.get(opt.id)}
              />
            )
          })}
          {hiddenCount > 0 && !showAll && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowAll(true) }}
              className="w-full px-3 py-1.5 text-label text-left text-accent"
            >
              Show {hiddenCount} more…
            </button>
          )}
        </>
      )}
    </div>
  )
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  customerLanguages,
  'data-testid': testId,
  required,
  error,
  helperText,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const { floated } = useFloatingLabel({ value, focused: open })
  const listRef = useRef<HTMLUListElement>(null)
  const id = useId()

  const selectedOption = options.find((o) => o.id === value)

  const isTiered = customerLanguages !== undefined && customerLanguages.length > 0
  const tiers = isTiered ? splitInstructorTiers(options, customerLanguages) : null

  const flatOptions = tiers
    ? [...tiers.tier1, ...tiers.tier2, ...tiers.tier3, ...tiers.tier4]
    : options

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (!open || focusedIdx < 0 || !listRef.current) return
    const item = listRef.current.querySelector(`[id="${id}-opt-${focusedIdx}"]`) as HTMLElement | null
    item?.scrollIntoView({ block: 'nearest' })
  }, [focusedIdx, open, id])

  const select = useCallback((optionId: string) => {
    onChange(optionId)
    setOpen(false)
  }, [onChange])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
        setFocusedIdx(Math.max(0, flatOptions.findIndex((o) => o.id === value)))
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIdx((i) => Math.min(i + 1, flatOptions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIdx((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (focusedIdx >= 0 && focusedIdx < flatOptions.length) {
          select(flatOptions[focusedIdx].id)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
    }
  }

  return (
    <FieldShell id={id} required={required} error={error} helperText={helperText} className="relative flex flex-col gap-1.5 w-full">
      <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-list`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-help` : undefined}
        data-testid={testId}
        onClick={() => { setOpen(!open); if (!open) setFocusedIdx(Math.max(0, flatOptions.findIndex((o) => o.id === value))) }}
        onKeyDown={handleKeyDown}
        className={cn('field-underline w-full text-body pl-0 pr-8 text-left', label ? 'pt-4 pb-1.5' : 'py-2.5')}
        style={{
          color: selectedOption ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          ...(error ? { borderBottomColor: 'var(--color-destructive)' } : {}),
          ...(open && !error ? { borderBottomColor: 'var(--color-primary)', borderBottomWidth: '2px' } : {}),
        }}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate">{selectedOption?.label ?? placeholder}</span>
          {selectedOption?.languages && selectedOption.languages.length > 0 && (
            <LanguageFlags languages={selectedOption.languages} className="text-body flex-shrink-0" />
          )}
        </span>
        <ChevronDown
          size={12}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-theme text-secondary"
          style={{ transform: open ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)' }}
        />
      </button>

      {label && (
        <label
          htmlFor={id}
          className={cn(
            'absolute left-0 pointer-events-none transition-all',
            floated
              ? cn('top-0 text-[10px] font-medium', open ? 'text-primary' : 'text-secondary')
              : 'top-3 text-body text-secondary',
          )}
          style={{ transitionDuration: 'var(--transition-speed)' }} /* design-ok */
        >
          {label}{required && <span className="text-destructive"> *</span>}
        </label>
      )}

      {open && (
        <ul
          id={`${id}-list`}
          ref={listRef}
          role="listbox"
          aria-activedescendant={focusedIdx >= 0 ? `${id}-opt-${focusedIdx}` : undefined}
          className="absolute top-full left-0 w-full mt-1 rounded-theme overflow-auto z-[var(--z-dropdown)] py-1"
          style={{
            maxHeight: '280px',
            backgroundColor: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-glass-border)',
            boxShadow: '0 8px 32px var(--color-glass-shadow-elevated)',
          }}
        >
          {tiers ? (
            (() => {
              const firstNonEmpty =
                tiers.tier1.length > 0 ? 1 :
                tiers.tier2.length > 0 ? 2 :
                tiers.tier3.length > 0 ? 3 : 4
              return (
                <>
                  <TierSection
                    title="Preferred & matching language"
                    items={tiers.tier1}
                    defaultOpen={firstNonEmpty === 1}
                    value={value}
                    onSelect={select}
                    idPrefix={id}
                    globalIdxOffset={0}
                    focusedIdx={focusedIdx}
                    setFocusedIdx={setFocusedIdx}
                    customerLanguages={customerLanguages}
                  />
                  <TierSection
                    title="Matching language"
                    items={tiers.tier2}
                    defaultOpen={firstNonEmpty === 2}
                    value={value}
                    onSelect={select}
                    idPrefix={id}
                    globalIdxOffset={tiers.tier1.length}
                    focusedIdx={focusedIdx}
                    setFocusedIdx={setFocusedIdx}
                    customerLanguages={customerLanguages}
                  />
                  <TierSection
                    title="Preferred"
                    items={tiers.tier3}
                    defaultOpen={firstNonEmpty === 3}
                    value={value}
                    onSelect={select}
                    idPrefix={id}
                    globalIdxOffset={tiers.tier1.length + tiers.tier2.length}
                    focusedIdx={focusedIdx}
                    setFocusedIdx={setFocusedIdx}
                  />
                  <TierSection
                    title="All instructors"
                    items={tiers.tier4}
                    defaultOpen={firstNonEmpty === 4}
                    value={value}
                    onSelect={select}
                    idPrefix={id}
                    globalIdxOffset={tiers.tier1.length + tiers.tier2.length + tiers.tier3.length}
                    focusedIdx={focusedIdx}
                    setFocusedIdx={setFocusedIdx}
                  />
                </>
              )
            })()
          ) : (
            options.map((opt, idx) => (
              <OptionRow
                key={opt.id}
                opt={opt}
                isSelected={opt.id === value}
                isFocused={idx === focusedIdx}
                onSelect={() => select(opt.id)}
                onHover={() => setFocusedIdx(idx)}
                id={`${id}-opt-${idx}`}
              />
            ))
          )}
        </ul>
      )}
      </div>
    </FieldShell>
  )
}
