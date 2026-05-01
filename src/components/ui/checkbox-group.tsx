'use client'

import { useId } from 'react'
import { FieldError } from '@/components/ui/field-shell'
import { PillToggleSection } from '@/components/ui/pill-toggle-section'

interface CheckboxGroupProps {
  label: string
  items: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
  error?: string
  required?: boolean
  hideLabel?: boolean
  columns?: 2 | 3
}

function CheckboxGroup({ label, items, selected, onChange, error, required, hideLabel, columns = 2 }: CheckboxGroupProps) {
  const baseId = useId()
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    )
  }

  return (
    <PillToggleSection label={label} required={required} hideLabel={hideLabel} gap="md">
      <div className={`grid gap-2 ${columns === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {items.map(({ value, label: itemLabel }) => {
          const checked = selected.includes(value)
          return (
            <label
              key={value}
              className="flex items-center gap-2 cursor-pointer select-none text-body text-primary"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(value)}
                className="rounded-[var(--border-radius-button)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-glow)]"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span>{itemLabel}</span>
            </label>
          )
        })}
      </div>
      <FieldError id={`${baseId}-error`} message={error} />
    </PillToggleSection>
  )
}

export { CheckboxGroup }
export type { CheckboxGroupProps }
