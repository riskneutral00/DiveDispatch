'use client'

import { SaveButton } from '@/components/ui/save-button'
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
}: ProfileFormFooterProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {errorMessage ? <InlineError>{errorMessage}</InlineError> : null}
      {leftAction ? (
        <div className="flex items-center justify-between">
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
    </div>
  )
}
