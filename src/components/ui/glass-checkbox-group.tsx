'use client'

import { useId } from 'react'
import { GlassFieldError } from '@/components/ui/field-shell'

interface GlassCheckboxGroupProps {
  label: string
  items: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
  error?: string
  columns?: 2 | 3
}

function GlassCheckboxGroup({ label, items, selected, onChange, error, columns = 2 }: GlassCheckboxGroupProps) {
  const baseId = useId()
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    )
  }

  return (
    <fieldset className="flex flex-col gap-2 w-full border-0 p-0 m-0 min-w-0">
      <legend className="text-sm font-medium text-secondary w-full px-0">
        {label}
      </legend>
      <div className={`grid gap-2 ${columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
        {items.map(({ value, label: itemLabel }) => {
          const checked = selected.includes(value)
          return (
            <label
              key={value}
              className="flex items-center gap-2 cursor-pointer select-none text-sm text-primary"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(value)}
                className="rounded"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span>{itemLabel}</span>
            </label>
          )
        })}
      </div>
      <GlassFieldError id={`${baseId}-error`} message={error} />
    </fieldset>
  )
}

export { GlassCheckboxGroup }
export type { GlassCheckboxGroupProps }
