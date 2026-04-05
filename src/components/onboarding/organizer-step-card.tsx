'use client'

import { useEffect, type ReactNode } from 'react'
import { Button, Card } from '@/components/ui'

interface OrganizerStepCardProps {
  title: string
  subtitle: string
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  loading?: boolean
  disabled?: boolean
  autoAdvance?: boolean
  children: ReactNode
}

export function OrganizerStepCard({
  title,
  subtitle,
  onBack,
  onNext,
  nextLabel = 'Next',
  loading = false,
  disabled = false,
  autoAdvance = false,
  children,
}: OrganizerStepCardProps) {
  useEffect(() => {
    if (autoAdvance) onNext()
  }, [autoAdvance, onNext])

  if (autoAdvance) return null

  return (
    <Card padding="lg">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1 text-primary">
          {title}
        </h2>
        <p className="text-sm text-secondary">
          {subtitle}
        </p>
      </div>

      {children}

      <div className="flex gap-3 mt-2" data-testid="wizard-nav">
        {onBack && (
          <Button variant="secondary" fullWidth onClick={onBack}>
            Back
          </Button>
        )}
        <Button
          variant="primary"
          fullWidth
          disabled={disabled || loading}
          loading={loading}
          onClick={onNext}
        >
          {nextLabel}
        </Button>
      </div>
    </Card>
  )
}
