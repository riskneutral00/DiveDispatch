'use client'

import { SaveButton } from '@/components/ui/save-button'
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
}: ProfileFormFooterProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {errorMessage ? (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {errorMessage}
        </p>
      ) : null}
      <SaveButton
        saving={saving}
        saved={saved}
        isDirty={isDirty}
        isUpdate={isUpdate}
        disabled={disabled}
        label={saveLabel}
      />
    </div>
  )
}
