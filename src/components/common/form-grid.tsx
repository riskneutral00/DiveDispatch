/**
 * FormGrid — 12-column grid system for form layouts.
 *
 * Field sizes:
 *   xs=2  sm=3  md=4  lg=6  full=12
 *
 * Desktop: grid-cols-12. Mobile (<640px): all fields col-span-12, xs→col-span-6.
 */

import type { ReactNode } from 'react'

interface FormGridProps {
  children: ReactNode
  className?: string
}

export function FormGrid({ children, className }: FormGridProps) {
  return (
    <div
      className={['grid grid-cols-12 gap-4', className].filter(Boolean).join(' ')}
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
    <div className={[DESKTOP_SPANS[size], className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}
