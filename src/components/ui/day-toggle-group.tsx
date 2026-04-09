'use client'

import { FieldLabel } from '@/components/ui/field-shell'
import { InlineError } from '@/components/ui/inline-error'

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

interface DayToggleGroupProps {
  selected: number[]
  onChange: (days: number[]) => void
  disabledDays?: number[]
  error?: string
  label?: string
}

export function DayToggleGroup({ selected, onChange, disabledDays = [], error, label }: DayToggleGroupProps) {
  function toggle(day: number) {
    if (disabledDays.includes(day)) return
    onChange(
      selected.includes(day)
        ? selected.filter((d) => d !== day)
        : [...selected, day],
    )
  }

  return (
    <div>
      {label && <FieldLabel className="mb-1.5">{label}</FieldLabel>}
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map((d) => {
          const active = selected.includes(d.value)
          const locked = disabledDays.includes(d.value)
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => toggle(d.value)}
              disabled={locked}
              className="px-2.5 py-1 text-label rounded-full font-medium transition-all duration-theme min-h-[44px] min-w-[44px] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: active ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                color: active ? 'var(--color-text-on-primary)' : locked ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-glass-border)'}`,
              }}
            >
              {d.label}
            </button>
          )
        })}
      </div>
      {error && <InlineError size="sm">{error}</InlineError>}
    </div>
  )
}
