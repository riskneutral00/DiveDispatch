'use client'

import type { ReactNode } from 'react'
import { LoadingState, type LoadingStateVariant } from '@/components/ui/loading-state'
import { FormFooter } from '@/components/ui/form-footer'

export type FormShellLoadingVariant = 'spinner' | 'pulse-text' | 'plain'

const LEGACY_VARIANT_MAP: Record<FormShellLoadingVariant, LoadingStateVariant> = {
  spinner: 'spinner',
  'pulse-text': 'pulse',
  plain: 'pulse',
}

interface FormShellProps {
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
  onCancel?: () => void

  loadingVariant?: FormShellLoadingVariant
  loadingMessage?: string
  hideFooter?: boolean
}

export function FormShell({
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
  onCancel,
  loadingVariant,
  loadingMessage,
  hideFooter = false,
}: FormShellProps) {
  if (loading) {
    return (
      <LoadingState
        variant={loadingVariant ? LEGACY_VARIANT_MAP[loadingVariant] : 'spinner'}
        scope="inline"
        className="py-16"
        message={loadingMessage}
      />
    )
  }

  const footerDisabled = disabled || (disableSaveWhenInvalid ? !isValid : false)

  return (
    <form onSubmit={onSubmit} noValidate className={className || 'space-y-6'}>
      {children}
      {!hideFooter && (
        <FormFooter
          errorMessage={footerErrorMessage ?? errorMessage}
          saving={saving}
          saved={saved}
          isDirty={isDirty}
          isUpdate={isUpdate}
          disabled={footerDisabled}
          saveLabel={saveLabel}
          leftAction={footerLeftAction}
          onCancel={onCancel}
        />
      )}
    </form>
  )
}
