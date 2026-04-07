import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface InlineErrorProps {
  children: ReactNode
  centered?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const sizeMap = { sm: 'text-label', md: 'text-body' } as const

export function InlineError({ children, centered, size = 'md', className }: InlineErrorProps) {
  return (
    <p
      role="alert"
      className={cn(sizeMap[size], 'text-destructive', centered && 'text-center', className)}
    >
      {children}
    </p>
  )
}
