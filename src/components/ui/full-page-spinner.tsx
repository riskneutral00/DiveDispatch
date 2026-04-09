'use client'

import { Spinner } from '@/components/ui/spinner'

interface FullPageSpinnerProps {
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function FullPageSpinner({ label, size, className }: FullPageSpinnerProps) {
  return (
    <div
      className={
        className ??
        'min-h-screen flex items-center justify-center text-secondary'
      }
    >
      <Spinner size={size} label={label} />
    </div>
  )
}
