'use client'

import type { ReactNode } from 'react'
import { ProfileFormLoading } from '@/components/profiles/profile-form-loading'
import { ProfileFormFooter } from '@/components/profiles/profile-form-footer'

/**
 * ProfileFormShell — Unified form layout for all role-specific profile UIs.
 *
 * ⚪ WHO OWNS useProfileForm?
 * The wrapper component or page layer. The shell is purely presentational.
 *
 * ⚪ SAVE / VALIDITY POLICY:
 * – Default (loose): Save button enabled when dirty; hook validates on click.
 * – Strict mode (opt-in): Pass disableSaveWhenInvalid={true} + isValid prop to disable Save until schema passes.
 * – Dive Center uses strict mode; other forms default to loose.
 *
 * Pass `footerErrorMessage` from `useProfileForm` (server + schema `_form` / root path).
 */

interface ProfileFormShellProps {
  // Hook state (required)
  loading: boolean
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void

  // Footer passthrough (required)
  footerErrorMessage?: string | null
  /** @deprecated Use `footerErrorMessage` for canonical form error wiring. */
  errorMessage?: string | null
  saving: boolean
  saved: boolean
  isDirty: boolean
  isUpdate: boolean

  // Optional footer overrides
  disabled?: boolean
  disableSaveWhenInvalid?: boolean
  isValid?: boolean
  saveLabel?: string

  // Layout
  children: ReactNode
  className?: string
  /** Optional element rendered to the left of the Save button. */
  footerLeftAction?: ReactNode

  // Loading customization
  loadingVariant?: 'spinner' | 'pulse-text' | 'plain'
  loadingMessage?: string
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
}: ProfileFormShellProps) {
  if (loading) {
    return (
      <ProfileFormLoading
        variant={loadingVariant}
        message={loadingMessage}
      />
    )
  }

  // Compute footer disabled state
  const footerDisabled = disabled || (disableSaveWhenInvalid ? !isValid : false)

  return (
    <form onSubmit={onSubmit} noValidate className={className || 'space-y-6'}>
      {children}
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
    </form>
  )
}
