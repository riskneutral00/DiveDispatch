'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { SaveButton } from '@/components/ui/save-button'
import { BottomActionBar } from '@/components/ui/bottom-action-bar'
import { InlineError } from '@/components/ui/inline-error'
import { cn } from '@/lib/utils/cn'

export interface ProfileFormFooterProps {
  errorMessage?: string | null
  saving: boolean
  saved: boolean
  isDirty: boolean
  isUpdate: boolean
  disabled?: boolean
  saveLabel?: string
  className?: string
  leftAction?: React.ReactNode
  onCancel?: () => void
}

export function ProfileFormFooter({
  errorMessage,
  saving,
  saved,
  isDirty,
  isUpdate,
  disabled,
  saveLabel,
  className,
  leftAction,
  onCancel,
}: ProfileFormFooterProps) {
  const t = useTranslations('common')

  return (
    <div className={cn('space-y-4', className)}>
      {errorMessage ? <InlineError>{errorMessage}</InlineError> : null}
      <BottomActionBar>
        {onCancel ? (
          <div className="grid grid-cols-2 gap-3"> {/* design-ok */}
            <Button variant="ghost" onClick={onCancel} disabled={saving}>
              {t('cancel')}
            </Button>
            <SaveButton
              saving={saving}
              saved={saved}
              isDirty={isDirty}
              isUpdate={isUpdate}
              disabled={disabled}
              label={saveLabel}
            />
          </div>
        ) : leftAction ? (
          <div className="flex items-center justify-between gap-3">
            {leftAction}
            <SaveButton
              saving={saving}
              saved={saved}
              isDirty={isDirty}
              isUpdate={isUpdate}
              disabled={disabled}
              label={saveLabel}
            />
          </div>
        ) : (
          <SaveButton
            saving={saving}
            saved={saved}
            isDirty={isDirty}
            isUpdate={isUpdate}
            disabled={disabled}
            label={saveLabel}
          />
        )}
      </BottomActionBar>
    </div>
  )
}
