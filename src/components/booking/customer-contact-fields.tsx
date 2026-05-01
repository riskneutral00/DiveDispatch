'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2 } from 'lucide-react'
import { Button, ButtonGroup, Input, PhoneField } from '@/components/ui'
import type { ButtonGroupOption } from '@/components/ui'
import { EmailField } from '@/components/ui/email-field'
import { NameField } from '@/components/ui/name-field'
import { LanguageField } from '@/components/ui/language-field'
import type { Language } from '@/lib/types/language'

export type CustomerContactType = 'email' | 'whatsapp' | 'line'

export interface CustomerContactLabels {
  name: string
  removeAria?: string
  contactTypeAria: string
  emailOption: string
  whatsappOption: string
  lineOption: string
  whatsappField: string
  emailField?: string
  lineField?: string
  emailPlaceholder: string
  linePlaceholder: string
}

export interface CustomerContactFieldsProps {
  name: string
  onNameChange: (v: string) => void
  nameRequired?: boolean
  nameError?: string
  onRemove?: () => void
  contactType: CustomerContactType
  onContactTypeChange: (v: CustomerContactType) => void
  contactValue: string
  onContactValueChange: (v: string) => void
  contactRequired?: boolean
  hint?: ReactNode
  languages: Language[]
  onLanguagesChange: (v: Language[]) => void
  labels: CustomerContactLabels
}

export function CustomerContactFields({
  name,
  onNameChange,
  nameRequired,
  nameError,
  onRemove,
  contactType,
  onContactTypeChange,
  contactValue,
  onContactValueChange,
  contactRequired,
  hint,
  languages,
  onLanguagesChange,
  labels,
}: CustomerContactFieldsProps) {
  const tCommon = useTranslations('common')
  const contactOptions: ButtonGroupOption[] = [
    { value: 'email', label: labels.emailOption },
    { value: 'whatsapp', label: labels.whatsappOption },
    { value: 'line', label: labels.lineOption },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <NameField
          scope="given"
          label={labels.name}
          value={name}
          onChange={onNameChange}
          required={nameRequired}
          error={nameError}
          className="flex-1"
        />
        {onRemove && (
          <Button
            variant="destructive-ghost"
            size="sm"
            type="button"
            onClick={onRemove}
            aria-label={labels.removeAria}
          >
            <Trash2 size={16} />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <ButtonGroup
          variant="segment"
          value={contactType}
          onChange={(v) => onContactTypeChange(v as CustomerContactType)}
          aria-label={labels.contactTypeAria}
          options={contactOptions}
        />
        {contactType === 'whatsapp' ? (
          <PhoneField
            label={labels.whatsappField}
            value={contactValue}
            onChange={onContactValueChange}
            required={contactRequired}
          />
        ) : contactType === 'email' ? (
          <EmailField
            label={labels.emailField ?? labels.emailOption}
            value={contactValue}
            onChange={onContactValueChange}
            placeholder={labels.emailPlaceholder}
            required={contactRequired}
          />
        ) : (
          <Input
            label={labels.lineField}
            value={contactValue}
            onChange={(e) => onContactValueChange(e.target.value)}
            placeholder={labels.linePlaceholder}
            type="text"
            required={contactRequired}
          />
        )}
        {hint}
      </div>

      <LanguageField
        label={tCommon('customerLanguages')}
        value={languages}
        onChange={onLanguagesChange}
      />
    </div>
  )
}
