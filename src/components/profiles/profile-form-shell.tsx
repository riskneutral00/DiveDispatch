'use client'

import type { ReactNode } from 'react'
import { ProfileFormLoading } from '@/components/profiles/profile-form-loading'
import { ProfileFormFooter } from '@/components/profiles/profile-form-footer'

interface ProfileFormShellProps {
  loading: boolean
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void

  footerErrorMessage?: string | null
  errorMessage?: string | null
  saving: boolean
  saved: boolean
  isDirty: boolean
  isUpdate: boolean

  disabled?: boolean
  disableSaveWhenInvalid?: boolean
  isValid?: boolean
  saveLabel?: string

  children: ReactNode
  className?: string
  footerLeftAction?: ReactNode

  loadingVariant?: 'spinner' | 'pulse-text' | 'plain'
  loadingMessage?: string
  hideFooter?: boolean
}

export function ProfileFormShell({
  loading,
  onSubmit,
  footerErrorMessage,
  errorMessage,
  saving,
  saved,
  isDirty,
  isUpdate,
  disabled,
  disableSaveWhenInvalid = false,
  isValid,
  saveLabel,
  children,
  className,
  footerLeftAction,
  loadingVariant,
  loadingMessage,
  hideFooter = false,
}: ProfileFormShellProps) {
  if (loading) {
    return (
      <ProfileFormLoading
        variant={loadingVariant}
        message={loadingMessage}
      />
    )
  }

  const footerDisabled = disabled || (disableSaveWhenInvalid ? !isValid : false)

  return (
    <form onSubmit={onSubmit} noValidate className={className || 'space-y-6'}>
      {children}
      {!hideFooter && (
        <ProfileFormFooter
          errorMessage={footerErrorMessage ?? errorMessage}
          saving={saving}
          saved={saved}
          isDirty={isDirty}
          isUpdate={isUpdate}
          disabled={footerDisabled}
          saveLabel={saveLabel}
          leftAction={footerLeftAction}
        />
      )}
    </form>
  )
}
