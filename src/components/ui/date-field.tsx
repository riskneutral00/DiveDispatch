'use client'

import { useId } from 'react'
import {
  DateField as AriaDateField,
  DateInput,
  DateSegment,
  Label,
} from 'react-aria-components'
import { CalendarDate, parseDate } from '@internationalized/date'
import { FieldError } from '@/components/ui/field-shell'
import { RequiredAsterisk } from '@/components/ui/required-asterisk'
import { cn } from '@/lib/utils/cn'

interface DateFieldProps {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  required?: boolean
  error?: string
  helperText?: string
  disabled?: boolean
  className?: string
  id?: string
  min?: string
  max?: string
  autoFocus?: boolean
  'data-testid'?: string
}

export function DateField({
  label,
  value,
  onChange,
  required,
  error,
  helperText,
  disabled,
  className,
  id: externalId,
  min,
  max,
  autoFocus,
  'data-testid': testId,
}: DateFieldProps) {
  const generatedId = useId()
  const id = externalId ?? generatedId

  const dateValue = value ? safeParse(value) : null
  const minValue = min ? safeParse(min) : undefined
  const maxValue = max ? safeParse(max) : undefined

  return (
    <AriaDateField
      id={id}
      value={dateValue}
      onChange={(d) => onChange(d ? formatIso(d) : null)}
      isRequired={required}
      isDisabled={disabled}
      isInvalid={!!error}
      minValue={minValue}
      maxValue={maxValue}
      autoFocus={autoFocus}
      data-testid={testId}
      className={cn(
        'relative w-full',
        className?.includes('w-') || className?.includes('field-') || className?.includes('col-span')
          ? ''
          : 'w-full',
        className,
      )}
    >
      <div className="relative pt-4 pb-1.5 field-underline">
        <Label className="absolute top-0 left-0 text-[10px] font-medium text-secondary label-float-in pointer-events-none">
          {label}
          {required && <RequiredAsterisk />}
        </Label>
        <DateInput className="flex items-center gap-1 text-body text-primary">
          {(segment) => (
            <DateSegment
              segment={segment}
              className={cn(
                'rounded px-0.5 outline-none',
                'data-[placeholder]:text-secondary',
                'focus:bg-[color-mix(in_oklab,var(--color-primary)_12%,transparent)]',
                'data-[invalid]:text-destructive',
              )}
            />
          )}
        </DateInput>
      </div>

      {error && <FieldError id={`${id}-error`} message={error} />}
      {!error && helperText && (
        <p id={`${id}-helper`} className="text-body text-secondary truncate">
          {helperText}
        </p>
      )}
    </AriaDateField>
  )
}

function safeParse(iso: string): CalendarDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  try {
    return parseDate(iso)
  } catch {
    return null
  }
}

function formatIso(d: { year: number; month: number; day: number }): string {
  const y = String(d.year).padStart(4, '0')
  const m = String(d.month).padStart(2, '0')
  const day = String(d.day).padStart(2, '0')
  return `${y}-${m}-${day}`
}
