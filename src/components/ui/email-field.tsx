'use client'

import { Input } from '@/components/ui/input'

interface EmailFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  error?: string
  helperText?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  autoFocus?: boolean
}

export function EmailField({
  label,
  value,
  onChange,
  required,
  error,
  helperText,
  placeholder,
  disabled,
  className,
  id,
  autoFocus,
}: EmailFieldProps) {
  return (
    <Input
      id={id}
      type="email"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onChange(value.trim().toLowerCase())}
      autoComplete="email"
      inputMode="email"
      autoCapitalize="none"
      spellCheck={false}
      required={required}
      error={error}
      helperText={helperText}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      autoFocus={autoFocus}
    />
  )
}
