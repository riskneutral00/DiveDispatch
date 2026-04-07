'use client'

import { LanguageField } from '@/components/profiles/language-field'
import type { Language } from '@/lib/types/language'

interface ProfileLanguagesSectionProps {
  variant: 'customer' | 'teaching'
  value: Language[]
  onChange: (languages: Language[]) => void
  section?: string
  disabled?: boolean
}

export function ProfileLanguagesSection({
  variant,
  value,
  onChange,
  section,
  disabled,
}: ProfileLanguagesSectionProps) {
  if (section && section !== 'languages') return null

  return (
    <LanguageField
      variant={variant}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  )
}
