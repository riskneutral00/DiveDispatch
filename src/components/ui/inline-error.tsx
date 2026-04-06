import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface InlineErrorProps {
  children: ReactNode
  centered?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const sizeMap = { sm: 'text-xs', md: 'text-sm' } as const

/**
 * Simple inline error text with role="alert".
 * Use for mutation/validation errors that don't need an icon or background.
 * For icon+background errors, use ErrorAlert. For field-linked errors, use FieldError.
 */
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
