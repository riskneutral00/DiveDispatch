'use client'

import { SaveButton } from '@/components/ui/save-button'
import { InlineError } from '@/components/ui/inline-error'
import { cn } from '@/lib/utils/cn'

export interface ProfileFormFooterProps {
  /** Use `footerErrorMessage` from `useProfileForm` (server + schema-level footer errors). */
  errorMessage?: string | null
  saving: boolean
  saved: boolean
  isDirty: boolean
  isUpdate: boolean
  disabled?: boolean
  saveLabel?: string
  className?: string
  /** Optional element rendered to the left of the Save button (e.g. an Add action). */
  leftAction?: React.ReactNode
}

/**
 * Shared profile form footer: error line + submit button.
 * Success feedback is via Sonner toast from `useProfileForm` (no duplicate inline copy).
 */
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
