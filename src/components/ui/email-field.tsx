'use client'

import { Input } from '@/components/ui/input'
import { resolveFieldWidth } from '@/lib/utils/field-width'

interface EmailFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  required?: boolean
  error?: string
  helperText?: string
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  onClick?: React.MouseEventHandler<HTMLInputElement>
  className?: string
  id?: string
  autoFocus?: boolean
}

export function EmailField({
  label,
  value,
  onChange,
  onBlur,
  required,
  error,
  helperText,
  placeholder,
  disabled,
  readOnly,
  onClick,
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
      onBlur={() => { onChange(value.trim().toLowerCase()); onBlur?.() }}
      autoComplete="email"
      inputMode="email"
      autoCapitalize="none"
      spellCheck={false}
      required={required}
      error={error}
      helperText={helperText}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      onClick={onClick}
      className={resolveFieldWidth('field-lg', className)}
      autoFocus={autoFocus}
    />
  )
}
