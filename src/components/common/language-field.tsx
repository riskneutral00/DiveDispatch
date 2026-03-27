'use client'

import { LanguagePicker } from '@/components/common/language-picker'
import type { Language } from '@/lib/types/language'
import type { LanguageCode } from '@/lib/constants/dive-languages'

interface LanguageFieldProps {
  label: string
  value: Language[]
  onChange: (languages: Language[]) => void
  max?: number
  commonLanguageCodes?: LanguageCode[]
  disabled?: boolean
  required?: boolean
}

export function LanguageField({
  label,
  value,
  onChange,
  max = 4,
  commonLanguageCodes,
  disabled,
  required,
}: LanguageFieldProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label
        className="text-sm font-medium"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
        {required && <span style={{ color: 'var(--color-destructive)' }}> *</span>}
      </label>
      <LanguagePicker
        value={value}
        onChange={onChange}
        max={max}
        commonLanguageCodes={commonLanguageCodes}
        disabled={disabled}
      />
    </div>
  )
}
