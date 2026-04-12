'use client'

import { useEffect, type FormEventHandler, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CardTitle } from '@/components/ui/card-title'
import { ErrorAlert } from '@/components/ui/error-alert'

interface PrimaryAction {
  label: string
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary'
  fullWidth?: boolean
}

interface WizardStepShellProps {
  title?: string
  subtitle?: string
  card?: boolean
  onBack?: () => void
  backLabel?: string
  backVariant?: 'ghost' | 'secondary'
  primary: PrimaryAction
  onSubmit?: FormEventHandler<HTMLFormElement>
  error?: string | null
  autoAdvance?: boolean
  children: ReactNode
}

export function WizardStepShell({
  title,
  subtitle,
  card = true,
  onBack,
  backLabel,
  backVariant = 'secondary',
  primary,
  onSubmit,
  error,
  autoAdvance = false,
  children,
}: WizardStepShellProps) {
  const t = useTranslations('common')
  const resolvedBackLabel = backLabel ?? t('back')

  const primaryType = primary.type ?? 'button'
  const primaryVariant = primary.variant ?? 'primary'
  const primaryFullWidth = primary.fullWidth ?? true

  const onClick = primary.onClick

  useEffect(() => {
    if (autoAdvance && onClick) onClick()
  }, [autoAdvance, onClick])

  if (autoAdvance) return null

  const navClass = primaryFullWidth
    ? 'flex gap-3'
    : `flex gap-3 ${onBack ? 'justify-between' : 'justify-end'}`

  const body = (
    <>
      {(title || subtitle) && (
        <div className="mb-6">
          {title && (
            <CardTitle weight="bold" className="mb-1">
              {title}
            </CardTitle>
          )}
          {subtitle && <p className="text-body text-secondary">{subtitle}</p>}
        </div>
      )}

      {children}

      <div aria-live="polite">{error && <ErrorAlert>{error}</ErrorAlert>}</div>

      <div className={navClass} data-testid="wizard-nav">
        {onBack && (
          <Button
            type="button"
            variant={backVariant}
            fullWidth={primaryFullWidth}
            onClick={onBack}
            disabled={primary.loading}
          >
            {resolvedBackLabel}
          </Button>
        )}
        <Button
          type={primaryType}
          variant={primaryVariant}
          fullWidth={primaryFullWidth}
          disabled={primary.disabled || primary.loading}
          loading={primary.loading}
          onClick={primaryType === 'button' ? onClick : undefined}
        >
          {primary.label}
        </Button>
      </div>
    </>
  )

  const inner = card ? (
    <Card padding="lg">{body}</Card>
  ) : (
    <div className="space-y-6">{body}</div>
  )

  if (onSubmit) {
    return (
      <form onSubmit={onSubmit} noValidate className={card ? undefined : 'space-y-6'}>
        {inner}
      </form>
    )
  }

  return inner
}
