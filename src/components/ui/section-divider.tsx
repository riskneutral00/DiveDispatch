'use client'

import { cn } from '@/lib/utils/cn'

interface SectionDividerProps {
  show?: boolean
  variant?: 'default' | 'soft'
  className?: string
}

export function SectionDivider({
  show = true,
  variant = 'default',
  className,
}: SectionDividerProps) {
  if (!show) return null
  return (
    <hr
      className={cn(
        'form-divider',
        variant === 'soft' && 'opacity-70 my-1',
        className,
      )}
    />
  )
}
