'use client'

/**
 * Simple native <select> with glass styling. For basic string-option dropdowns
 * in profile forms and portal steps.
 *
 * NOT the same as Select (select.tsx) which is a tiered instructor
 * select with keyboard navigation and language matching.
 *
 * Extracted by L8-27 from 4 inline copies across agent, instructor, divemaster
 * profile forms and portal step-contact.
 */

import { useId } from 'react'
import { cn } from '@/lib/utils/cn'
import { FieldError, FieldLabel } from '@/components/ui/field-shell'

interface OptionItem {
  value: string
  label: string
  disabled?: boolean
}

interface SimpleSelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: readonly string[] | readonly OptionItem[]
  error?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  /** Accessible label when no visible label is provided */
  'aria-label'?: string
  /** Pass-through for E2E test selectors */
  'data-testid'?: string
}

export function SimpleSelect({
  label,
  value,
  onChange,
  options,
  error,
  placeholder,
  required,
  disabled,
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: SimpleSelectProps) {
  const generatedId = useId()
  const id = generatedId

  return (
    <div className={cn("flex flex-col gap-1.5", className?.includes('field-') || className?.includes('w-') ? '' : 'w-full', className)}>
      {label && (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      )}
      <select
        id={label ? id : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
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
          const optDisabled = typeof opt === 'string' ? false : opt.disabled
          return (
            <option key={optValue} value={optValue} disabled={optDisabled}>
              {optLabel}
            </option>
          )
        })}
      </select>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}
