'use client'

import { LanguagePicker } from '@/components/common/language-picker'
import type { Language } from '@/lib/types/language'

type LanguageVariant = 'app' | 'customer' | 'teaching'

const VARIANT_CONFIG: Record<LanguageVariant, { label: string; max: number }> = {
  app: { label: 'App Language', max: 1 },
  customer: { label: 'Customer Languages', max: 4 },
  teaching: { label: 'Teaching Languages', max: 4 },
}

interface LanguageFieldProps {
  variant: LanguageVariant
  value: Language[]
  onChange: (languages: Language[]) => void
  disabled?: boolean
}

export function LanguageField({
  variant,
  value,
  onChange,
  disabled,
}: LanguageFieldProps) {
  const { label, max } = VARIANT_CONFIG[variant]

  return (
    <div className="flex flex-col gap-1.5 w-[calc(50%-0.5rem)]">
      <label
        className="text-sm font-medium"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
        <span style={{ color: 'var(--color-destructive)' }}> *</span>
      </label>
      <LanguagePicker
        value={value}
        onChange={onChange}
        max={max}
        disabled={disabled}
      />
    </div>
  )
}
