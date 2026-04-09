'use client'

import { cn } from '@/lib/utils/cn'

interface SectionDividerProps {
  show: boolean
  className?: string
}

export function SectionDivider({ show, className }: SectionDividerProps) {
  if (!show) return null
  return <hr className={cn('form-divider', className)} />
}
