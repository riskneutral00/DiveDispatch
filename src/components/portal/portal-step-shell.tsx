'use client'

import type { FormEventHandler, ReactNode } from 'react'
import { GlassButton } from '@/components/ui/glass-button'

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
  backLabel = 'Back',
  backVariant = 'ghost',
  onContinue,
  continueType = 'button',
  submitting,
  continueLabel = 'Continue',
  continueVariant = 'primary',
  continueSize = 'md',
  continueFullWidth = false,
  continueClassName,
}: PortalStepShellProps) {
  const content = (
    <>
      {children}

      <div aria-live="polite">
        {serverError && (
          <p
            className="text-sm text-center"
            style={{ color: 'var(--color-destructive)' }}
            role="alert"
          >
            {serverError}
          </p>
        )}
      </div>

      <div className={`flex gap-3 ${onBack ? 'justify-between' : 'justify-end'}`}>
        {onBack && (
          <GlassButton type="button" variant={backVariant} size="md" onClick={onBack} disabled={submitting}>
            {backLabel}
          </GlassButton>
        )}
        <GlassButton
          type={continueType}
          variant={continueVariant}
          size={continueSize}
          onClick={continueType === 'button' ? onContinue : undefined}
          loading={submitting}
          disabled={submitting}
          fullWidth={continueFullWidth}
          className={continueClassName}
        >
          {continueLabel}
        </GlassButton>
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
