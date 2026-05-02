'use client'

import { Input } from '@/components/ui/input'
import { resolveFieldWidth } from '@/lib/utils/field-width'

export type NameScope = 'given' | 'family' | 'nickname' | 'organization'

const AUTOCOMPLETE_MAP: Record<NameScope, string> = {
  given: 'given-name',
  family: 'family-name',
  nickname: 'nickname',
  organization: 'organization',
}

export const NAME_MAX_LENGTH = 100

interface NameFieldProps {
  scope: NameScope
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  required?: boolean
  error?: string
  helperText?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function NameField({
  scope,
  label,
  value,
  onChange,
  onBlur,
  required,
  error,
  helperText,
  placeholder,
  disabled,
  className,
  id,
}: NameFieldProps) {
  return (
    <Input
      id={id}
      type="text"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, NAME_MAX_LENGTH))}
      onBlur={() => { onBlur?.() }}
      autoComplete={AUTOCOMPLETE_MAP[scope]}
      autoCapitalize={scope === 'nickname' ? 'none' : 'words'}
      spellCheck={false}
      maxLength={NAME_MAX_LENGTH}
      required={required}
      error={error}
      helperText={helperText}
      placeholder={placeholder}
      disabled={disabled}
      className={resolveFieldWidth('field-md', className)}
    />
  )
}
