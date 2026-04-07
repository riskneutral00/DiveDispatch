'use client'

import { Spinner } from '@/components/ui/spinner'

interface FullPageSpinnerProps {
  label?: string
  className?: string
}

export function FullPageSpinner({ label, className }: FullPageSpinnerProps) {
  return (
    <div
      className={
        className ??
        'min-h-screen flex items-center justify-center text-secondary'
      }
    >
      <Spinner label={label} />
    </div>
  )
}
