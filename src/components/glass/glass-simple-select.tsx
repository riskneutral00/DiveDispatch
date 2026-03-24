/**
 * Simple native <select> with glass styling. For basic string-option dropdowns
 * in profile forms and portal steps.
 *
 * NOT the same as GlassSelect (glass-select.tsx) which is a tiered instructor
 * select with keyboard navigation and language matching.
 *
 * Extracted by L8-27 from 4 inline copies across agent, instructor, divemaster
 * profile forms and portal step-contact.
 */

interface GlassSimpleSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly string[] | readonly { value: string; label: string }[]
  error?: string
  placeholder?: string
  required?: boolean
  /** Pass-through for E2E test selectors */
  'data-testid'?: string
}

export function GlassSimpleSelect({
  label,
  value,
  onChange,
  options,
  error,
  placeholder,
  required,
  'data-testid': testId,
}: GlassSimpleSelectProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
        {required && <span style={{ color: 'var(--color-destructive)' }}> *</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        data-testid={testId}
        className="glass w-full text-sm px-3 py-2.5 focus:outline-none focus:ring-2 rounded-[var(--border-radius)]"
        style={{
          color: value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          outlineColor: error ? 'var(--color-destructive)' : 'var(--color-accent)',
          ...(error ? { boxShadow: '0 0 0 2px var(--color-destructive)' } : {}),
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => {
          const optValue = typeof opt === 'string' ? opt : opt.value
          const optLabel = typeof opt === 'string' ? opt : opt.label
          return (
            <option key={optValue} value={optValue}>
              {optLabel}
            </option>
          )
        })}
      </select>
      {error && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
