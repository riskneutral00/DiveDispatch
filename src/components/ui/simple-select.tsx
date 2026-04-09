'use client'

import { useId, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { FieldError } from '@/components/ui/field-shell'
import { useFloatingLabel } from '@/lib/hooks/use-floating-label'

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
  'aria-label'?: string
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
  const [focused, setFocused] = useState(false)
  const { floated } = useFloatingLabel({ value, focused })

  return (
    <div className={cn("relative", className?.includes('field-') || className?.includes('w-') || className?.includes('col-span') ? '' : 'w-full', className)}>
      <select /* design-ok */
        id={label ? id : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        data-testid={testId}
        className={cn(
          'field-underline w-full text-body appearance-none',
          label ? 'pt-4 pb-1.5' : 'py-2.5',
          'pl-0 pr-4',
        )}
        style={{ /* design-ok */
          color: value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          ...(error ? { borderBottomColor: 'var(--color-destructive)' } : {}),
          ...(focused && !error ? { borderBottomColor: 'var(--color-primary)', borderBottomWidth: '2px' } : {}),
        }}
      >
        <option value="" disabled />
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

      {label && (
        <label
          htmlFor={id}
          className={cn(
            'absolute left-0 pointer-events-none transition-all duration-theme',
            floated
              ? cn('top-0 text-[10px] font-medium label-float-in', focused ? 'text-primary' : 'text-secondary')
              : 'top-3 text-body text-secondary',
          )} /* design-ok */
        >
          {label}{required && <span className="text-destructive"> *</span>}
        </label>
      )}

      <span className="absolute right-0 top-3.5 pointer-events-none text-secondary">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>

      {error && <FieldError id={`${id}-error`} message={error} />}
    </div>
  )
}
