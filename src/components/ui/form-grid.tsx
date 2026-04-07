import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface FormGridProps {
  children: ReactNode
  className?: string
}

export function FormGrid({ children, className }: FormGridProps) {
  return (
    <div
      className={cn('grid grid-cols-12 gap-4', className)}
    >
      {children}
    </div>
  )
}

type FieldSize = 'xs' | 'sm' | 'md' | 'lg' | 'full'

const DESKTOP_SPANS: Record<FieldSize, string> = {
  xs: 'col-span-6 sm:col-span-2',
  sm: 'col-span-6 sm:col-span-3',
  md: 'col-span-12 sm:col-span-4',
  lg: 'col-span-12 sm:col-span-6',
  full: 'col-span-12',
}

interface FormFieldProps {
  size: FieldSize
  children: ReactNode
  className?: string
}

export function FormField({ size, children, className }: FormFieldProps) {
  return (
    <div className={cn(DESKTOP_SPANS[size], className)}>
      {children}
    </div>
  )
}
