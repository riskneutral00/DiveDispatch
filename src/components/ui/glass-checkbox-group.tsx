'use client'

interface GlassCheckboxGroupProps {
  label: string
  items: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
  error?: string
  columns?: 2 | 3
}

function GlassCheckboxGroup({ label, items, selected, onChange, error, columns = 2 }: GlassCheckboxGroupProps) {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <span className="text-sm font-medium text-secondary">
        {label}
      </span>
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
      {error && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

export { GlassCheckboxGroup }
export type { GlassCheckboxGroupProps }
