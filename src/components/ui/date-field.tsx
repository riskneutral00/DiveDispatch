'use client'

import { useId } from 'react'
import {
  DateField as AriaDateField,
  DateInput,
  DateSegment,
  Label,
} from 'react-aria-components'
import { CalendarDate, parseDate } from '@internationalized/date'
import { FieldMessage } from '@/components/ui/field-shell'
import { RequiredAsterisk } from '@/components/ui/required-asterisk'
import { cn } from '@/lib/utils/cn'
import { isValidISODate } from '@/lib/utils/date'
import { resolveFieldWidth } from '@/lib/utils/field-width'

interface DateFieldProps {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  onBlur?: () => void
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
  onBlur,
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
      onChange={(d) => onChange(d ? d.toString() : null)}
      onBlur={onBlur}
      isRequired={required}
      isDisabled={disabled}
      isInvalid={!!error}
      minValue={minValue}
      maxValue={maxValue}
      autoFocus={autoFocus}
      data-testid={testId}
      className={cn('relative', resolveFieldWidth('field-md', className))}
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

      <FieldMessage id={`${id}-error`} error={error} helperText={helperText} />
    </AriaDateField>
  )
}

function safeParse(iso: string): CalendarDate | null {
  if (!isValidISODate(iso)) return null
  try {
    return parseDate(iso)
  } catch {
    return null
  }
}
