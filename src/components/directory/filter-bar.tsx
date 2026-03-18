'use client'

import type { FilterDef } from '@/lib/constants/resource-filters'

interface FilterBarProps {
  filters: FilterDef[]
  values: Record<string, string>
  onChange: (id: string, value: string) => void
}

export function FilterBar({ filters, values, onChange }: FilterBarProps) {
  if (filters.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((filter) => (
        <div key={filter.id} className="relative w-40">
          <select
            value={values[filter.id] ?? filter.options[0]?.value ?? ''}
            onChange={(e) => onChange(filter.id, e.target.value)}
            aria-label={filter.label}
            className="w-full appearance-none pl-3 pr-7 py-1.5 text-sm rounded-[var(--border-radius)] focus:outline-none focus-visible:ring-2 cursor-pointer"
            style={{
              background: 'var(--color-glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--color-glass-border)',
              color: 'var(--color-text-primary)',
              outlineColor: 'var(--color-accent)',
              transitionDuration: 'var(--transition-speed)',
            }}
          >
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
            aria-hidden
            style={{ color: 'var(--color-text-secondary)' }}
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
        </div>
      ))}
    </div>
  )
}
