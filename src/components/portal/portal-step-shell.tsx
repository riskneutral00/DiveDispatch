'use client'

import type { FormEventHandler, ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/error-alert'

export interface PortalStepShellProps {
  children: ReactNode
  serverError?: string | null
  onSubmit?: FormEventHandler<HTMLFormElement>
  onBack?: () => void
  backLabel?: string
  backVariant?: 'ghost' | 'secondary'
  onContinue?: () => void
  continueType?: 'button' | 'submit'
  submitting?: boolean
  continueLabel?: string
  continueVariant?: 'primary' | 'secondary'
  continueSize?: 'sm' | 'md' | 'lg'
  continueFullWidth?: boolean
  continueClassName?: string
}

/**
 * Shared portal step layout: content column, server error region, Back + Continue row.
 */
export function PortalStepShell({
  children,
  serverError,
  onSubmit,
  onBack,
  backLabel,
  backVariant = 'ghost',
  onContinue,
  continueType = 'button',
  submitting,
  continueLabel,
  continueVariant = 'primary',
  continueSize = 'md',
  continueFullWidth = false,
  continueClassName,
}: PortalStepShellProps) {
  const t = useTranslations('common')
  const resolvedBackLabel = backLabel ?? t('back')
  const resolvedContinueLabel = continueLabel ?? t('continue')

  const content = (
    <>
      {children}

      <div aria-live="polite">
        {serverError && (
          <ErrorAlert>{serverError}</ErrorAlert>
        )}
      </div>

      <div className={`flex gap-3 ${onBack ? 'justify-between' : 'justify-end'}`}>
        {onBack && (
          <Button type="button" variant={backVariant} size="md" onClick={onBack} disabled={submitting}>
            {resolvedBackLabel}
          </Button>
        )}
        <Button
          type={continueType}
          variant={continueVariant}
          size={continueSize}
          onClick={continueType === 'button' ? onContinue : undefined}
          loading={submitting}
          disabled={submitting}
          fullWidth={continueFullWidth}
          className={continueClassName}
        >
          {resolvedContinueLabel}
        </Button>
      </div>
    </>
  )

  if (onSubmit) {
    return (
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {content}
      </form>
    )
  }

  return (
    <div className="space-y-6">
      {content}
    </div>
  )
}
