import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface FormSectionHeaderProps {
  label: ReactNode
  action?: ReactNode
  className?: string
}

export function FormSectionHeader({ label, action, className }: FormSectionHeaderProps) {
  return action ? (
    <div className={cn('flex items-center justify-between', className)}>
      <h2 className="font-semibold uppercase text-secondary text-section-header tracking-wide">
        {label}
      </h2>
      {action}
    </div>
  ) : (
    <h2 className={cn('font-semibold uppercase text-secondary text-section-header tracking-wide', className)}>
      {label}
    </h2>
  )
}
