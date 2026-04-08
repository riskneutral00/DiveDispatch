'use client'

import { Check, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui'

interface SaveButtonProps {
  saving: boolean
  saved: boolean
  isDirty: boolean
  isUpdate: boolean
  disabled?: boolean
  label?: string
  size?: 'sm' | 'md'
  onClick?: () => void
}

export function SaveButton({ saving, saved, isDirty, isUpdate, disabled, label, size = 'md', onClick }: SaveButtonProps) {
  const t = useTranslations('common')

  return (
    <div className="flex justify-end">
      <Button
        type={onClick ? 'button' : 'submit'}
        size={size}
        loading={saving}
        disabled={disabled || (isUpdate ? (!isDirty || saving) : saving)}
        onClick={onClick}
        style={saved ? { background: 'var(--color-active-fg)', borderColor: 'var(--color-active-fg)' } : undefined}
      >
        {saved ? (
          <>
            <Check size={16} aria-hidden />
            {t('saved')}
          </>
        ) : (
          <>
            <Save size={16} aria-hidden />
            {label ?? (isUpdate ? t('save') : t('createProfile'))}
          </>
        )}
      </Button>
    </div>
  )
}
