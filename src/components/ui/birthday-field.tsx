'use client'

import { DateField } from '@/components/ui/date-field'
import { maxBirthDate, minBirthDate } from '@/lib/constants/age'

interface BirthdayFieldProps {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  required?: boolean
  error?: string
  helperText?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function BirthdayField({
  label,
  value,
  onChange,
  required,
  error,
  helperText,
  disabled,
  className,
  id,
}: BirthdayFieldProps) {
  return (
    <DateField
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      required={required}
      error={error}
      helperText={helperText}
      disabled={disabled}
      className={className}
      min={minBirthDate()}
      max={maxBirthDate()}
    />
  )
}
