import type { ReactNode } from 'react'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { cn } from '@/lib/utils/cn'

interface SettingBlockProps {
  label: string
  note?: ReactNode
  action?: ReactNode
  required?: boolean
  children: ReactNode
  className?: string
  contentClassName?: string
  surface?: 'plain' | 'glass'
}

export function SettingBlock({
  label,
  note,
  action,
  required,
  children,
  className,
  contentClassName,
  surface = 'plain',
}: SettingBlockProps) {
  return (
    <section
      className={cn(
        surface === 'glass' && 'glass-container reading-plane rounded-theme p-4',
        className,
      )}
    >
      <FormSectionHeader
        label={label}
        note={note}
        action={action}
        required={required}
      />
      <div className={cn('mt-3 space-y-4', contentClassName)}>{children}</div>
    </section>
  )
}
