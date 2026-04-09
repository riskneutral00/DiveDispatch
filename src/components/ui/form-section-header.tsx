import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface FormSectionHeaderProps {
  label: ReactNode
  note?: ReactNode
  action?: ReactNode
  className?: string
}

export function FormSectionHeader({ label, note, action, className }: FormSectionHeaderProps) {
  const heading = (
    <h2 className={cn('font-semibold uppercase text-secondary text-section-header tracking-wide', !action && !note && className)}>
      {label}
    </h2>
  )

  if (action) {
    return (
      <div className={cn('flex items-center justify-between', className)}>
        {heading}
        {action}
      </div>
    )
  }

  if (note) {
    return (
      <div className={cn('flex items-baseline gap-2', className)}>
        {heading}
        <span className="text-body text-secondary">{note}</span>
      </div>
    )
  }

  return heading
}
