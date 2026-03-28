import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  message: string
  icon?: LucideIcon
}

export function EmptyState({ message, icon: Icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      {Icon && (
        <Icon className="text-secondary"
          size={24}
          style={{ opacity: 0.6 }}
        />
      )}
      <p className="text-sm text-center text-secondary">
        {message}
      </p>
    </div>
  )
}
