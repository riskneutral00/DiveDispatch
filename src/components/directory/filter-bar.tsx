'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FilterDef } from '@/lib/constants/resource-filters'
import { GlassSimpleSelect } from '@/components/glass/glass-simple-select'

interface FilterBarProps {
  filters: FilterDef[]
  values: Record<string, string>
  onChange: (id: string, value: string) => void
}

const glassStyle = {
  background: 'var(--color-glass-bg)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: '1px solid var(--color-glass-border)',
  color: 'var(--color-text-primary)',
  outlineColor: 'var(--color-accent)',
  transitionDuration: 'var(--transition-speed)',
}

function MultiSelectFilter({
  filter,
  value,
  onChange,
}: {
  filter: FilterDef
  value: string
  onChange: (id: string, value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listboxId = useId()
  const optionRefs = useRef<(HTMLLabelElement | null)[]>([])

  const selectedSet = useMemo(
    () => new Set(value && value !== 'all' ? value.split(',') : []),
    [value],
  )
  const allSelected = selectedSet.size === 0

  function toggleOption(optValue: string) {
    if (optValue === 'all') {
      onChange(filter.id, 'all')
      return
    }
    const next = new Set(selectedSet)
    if (next.has(optValue)) {
      next.delete(optValue)
    } else {
      next.add(optValue)
    }
    onChange(filter.id, next.size === 0 ? 'all' : [...next].join(','))
  }

  const closeDropdown = useCallback(() => {
    setIsOpen(false)
    setFocusedIndex(-1)
  }, [])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, closeDropdown])

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        closeDropdown()
        buttonRef.current?.focus()
        break
      case 'ArrowDown':
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
          setFocusedIndex(0)
        } else {
          setFocusedIndex((prev) =>
            prev < filter.options.length - 1 ? prev + 1 : 0,
          )
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
          setFocusedIndex(filter.options.length - 1)
        } else {
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : filter.options.length - 1,
          )
        }
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
          setFocusedIndex(0)
        } else if (focusedIndex >= 0) {
          toggleOption(filter.options[focusedIndex].value)
        }
        break
      case 'Home':
        if (isOpen) {
          e.preventDefault()
          setFocusedIndex(0)
        }
        break
      case 'End':
        if (isOpen) {
          e.preventDefault()
          setFocusedIndex(filter.options.length - 1)
        }
        break
      case 'Tab':
        if (isOpen) {
          closeDropdown()
        }
        break
    }
  }

  // Scroll focused option into view
  useEffect(() => {
    if (focusedIndex >= 0) {
      optionRefs.current[focusedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusedIndex])

  // Compact label showing selected count or "All"
  const label = allSelected
    ? filter.placeholder
    : `${selectedSet.size} selected`

  return (
    <div className="relative w-40" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={filter.label}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        onClick={() => {
          setIsOpen((prev) => !prev)
          if (!isOpen) setFocusedIndex(0)
        }}
        onKeyDown={handleKeyDown}
        className="w-full text-left appearance-none pl-3 pr-7 py-1.5 text-sm rounded-[var(--border-radius)] focus:outline-none focus-visible:ring-2 cursor-pointer"
        style={glassStyle}
      >
        {label}
      </button>
      <span
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-secondary"
        aria-hidden="true"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={filter.label}
          aria-multiselectable="true"
          onKeyDown={handleKeyDown}
          className="absolute left-0 top-full mt-1 w-48 rounded-[var(--border-radius)] py-1 z-30 max-h-60 overflow-y-auto"
          style={{
            ...glassStyle,
            boxShadow: '0 4px 12px var(--color-glass-shadow)',
          }}
        >
          {filter.options.map((opt, idx) => {
            const isAll = opt.value === 'all'
            const checked = isAll ? allSelected : selectedSet.has(opt.value)
            const isFocused = idx === focusedIndex
            return (
              <label
                key={opt.value}
                ref={(el) => { optionRefs.current[idx] = el }}
                role="option"
                aria-selected={checked}
                className="flex items-center gap-2 px-3 py-1 text-sm cursor-pointer hover:opacity-80"
                style={{
                  color: 'var(--color-text-primary)',
                  ...(isFocused
                    ? { background: 'var(--color-glass-border)', outline: '2px solid var(--color-accent)', outlineOffset: '-2px' }
                    : {}),
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleOption(opt.value)}
                  tabIndex={-1}
                  className="accent-[var(--color-primary)]"
                />
                {opt.label}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function FilterBar({ filters, values, onChange }: FilterBarProps) {
  if (filters.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((filter) =>
        filter.multiSelect ? (
          <MultiSelectFilter
            key={filter.id}
            filter={filter}
            value={values[filter.id] ?? 'all'}
            onChange={onChange}
          />
        ) : (
          <div key={filter.id} className="w-40">
            <GlassSimpleSelect
              value={values[filter.id] ?? filter.options[0]?.value ?? ''}
              onChange={(v) => onChange(filter.id, v)}
              aria-label={filter.label}
              options={filter.options}
            />
          </div>
        ),
      )}
    </div>
  )
}
