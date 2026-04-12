'use client'

import { FieldLabel } from '@/components/ui/field-shell'
import { InlineError } from '@/components/ui/inline-error'
import { TOUCH_TARGET_CLASS } from '@/lib/constants/button-sizes'
import { cn } from '@/lib/utils/cn'

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

export function DayToggleGroup({
  selected,
  onChange,
  disabledDays = [],
  error,
  label,
}: DayToggleGroupProps) {
  function toggle(day: number) {
    if (disabledDays.includes(day)) return
    onChange(
      selected.includes(day)
        ? selected.filter((d) => d !== day)
        : [...selected, day],
    )
  }

  return (
    <div className="reading-plane rounded-theme p-2">
      {label && <FieldLabel className="mb-1.5">{label}</FieldLabel>}
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map((d) => {
          const active = selected.includes(d.value)
          const locked = disabledDays.includes(d.value)
          return (
            <button /* design-ok: active-state background uses --color-primary which is not wired via @theme inline */
              key={d.value}
              type="button"
              onClick={() => toggle(d.value)}
              disabled={locked}
              aria-pressed={active}
              className={cn(
                'px-3 py-1 text-label rounded-full font-medium transition-all duration-theme border',
                TOUCH_TARGET_CLASS,
                'disabled:opacity-40 disabled:cursor-not-allowed',
                active
                  ? 'text-on-primary'
                  : locked
                    ? 'bg-surface-elevated border-glass-border text-secondary'
                    : 'bg-surface-elevated border-glass-border text-primary',
              )}
              style={
                active
                  ? {
                      background: 'var(--color-primary)',
                      borderColor: 'var(--color-primary)',
                    }
                  : undefined
              }
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
