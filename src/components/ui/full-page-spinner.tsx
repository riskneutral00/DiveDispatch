'use client'

import { Spinner } from '@/components/ui/spinner'

interface FullPageSpinnerProps {
  /** Shown under the spinner; omit for unlabeled loading */
  label?: string
  /** Match dashboard-shell loading wrapper */
  className?: string
}

/**
 * Viewport-centered loading state for dashboard shells and full-page gates.
 */
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
