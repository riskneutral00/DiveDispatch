'use client'

import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/convex-generated'
import { WizardStepShell } from '@/components/ui/wizard-step-shell'
import { Input } from '@/components/ui/input'
import { kebabBusinessName } from '@/lib/utils/slug'

interface StepBusinessSetupProps {
  businessName: string
  onBusinessNameChange: (value: string) => void
  onBack: () => void
  onContinue: () => void
  submitting?: boolean
  error?: string | null
}

export function StepBusinessSetup({
  businessName,
  onBusinessNameChange,
  onBack,
  onContinue,
  submitting,
  error,
}: StepBusinessSetupProps) {
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')

  const trimmed = businessName.trim()
  const slug = useMemo(() => kebabBusinessName(trimmed), [trimmed])
  const slugLongEnough = slug.length >= 2

  const availability = useQuery(
    api.organizations.isSlugAvailable,
    slugLongEnough ? { slug } : 'skip',
  )

  const isAvailable = slugLongEnough && availability === true
  const isTaken = slugLongEnough && availability === false
  const checking = slugLongEnough && availability === undefined

  const fieldError =
    trimmed.length > 0 && trimmed.length < 2
      ? t('businessNameTooShort')
      : isTaken
      ? t('businessSlugTaken')
      : undefined

  const canContinue = isAvailable && !submitting

  return (
    <WizardStepShell
      card={false}
      title={t('businessStepTitle')}
      subtitle={t('businessStepSubtitle')}
      onBack={onBack}
      primary={{
        label: tCommon('continue'),
        onClick: onContinue,
        disabled: !canContinue,
        loading: submitting || checking,
      }}
      error={error ?? null}
    >
      <div className="grid grid-cols-1 gap-4 w-full mb-4" data-testid="wizard-content">
        <Input
          label={tCommon('businessName')}
          value={businessName}
          onChange={(e) => onBusinessNameChange(e.target.value)}
          required
          error={fieldError}
        />
        {slugLongEnough && (
          <p className="text-body text-secondary">
            {t('businessUrlPreview')}: <span className="font-mono text-primary">/{slug}</span>
          </p>
        )}
      </div>
    </WizardStepShell>
  )
}
