import React from 'react'

type SpinnerSize = 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: SpinnerSize
  label?: string
  className?: string
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-5 h-5 border-2',
  lg: 'w-8 h-8 border-4',
}

export function Spinner({ size = 'md', label, className = '' }: SpinnerProps) {
  const spinner = (
    <span
      className={`${sizeClasses[size]} border-current border-t-transparent rounded-full animate-spin ${className}`}
      style={{ display: 'inline-block' }}
      aria-hidden
    />
  )

  if (!label) {
    return (
      <span role="status" aria-live="polite" className="inline-flex">
        <span className="sr-only">Loading</span>
        {spinner}
      </span>
    )
  }

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 text-secondary">
      {spinner}
      <span className="text-sm">{label}</span>
    </div>
  )
}
