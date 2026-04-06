import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface ListRowProps {
  compact?: boolean
  as?: 'div' | 'li'
  className?: string
  children: ReactNode
}

export function ListRow({ compact = false, as: Tag = 'div', className, children }: ListRowProps) {
  return (
    <Tag
      className={cn(
        'flex items-center justify-between gap-3 rounded-theme glass-container',
        compact ? 'p-2' : 'p-3',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
