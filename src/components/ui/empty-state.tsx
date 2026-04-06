import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface EmptyStateProps {
  message: string
  icon?: LucideIcon
  className?: string
}

export function EmptyState({ message, icon: Icon, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-8 gap-2', className)}>
      {Icon && (
        <Icon className="text-secondary"
          size={24}
          style={{ opacity: 0.6 }}
        />
      )}
      <p className="text-body text-center text-secondary">
        {message}
      </p>
    </div>
  )
}
