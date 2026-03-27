import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  message: string
  icon?: LucideIcon
}

export function EmptyState({ message, icon: Icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      {Icon && (
        <Icon
          size={24}
          style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }}
        />
      )}
      <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
        {message}
      </p>
    </div>
  )
}
