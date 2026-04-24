import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface InlineErrorProps {
  children: ReactNode
  size?: 'sm' | 'md'
  className?: string
}

const sizeMap = { sm: 'text-label', md: 'text-body' } as const

export function InlineError({ children, size = 'md', className }: InlineErrorProps) {
  return (
    <p role="alert" className={cn(sizeMap[size], 'text-destructive', className)}>
      {children}
    </p>
  )
}
