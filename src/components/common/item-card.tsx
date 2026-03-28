import type { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'

interface ItemCardProps {
  children: ReactNode
  onRemove?: () => void
  canRemove?: boolean
  'aria-label'?: string
}

export function ItemCard({ children, onRemove, canRemove = true, 'aria-label': ariaLabel = 'Remove item' }: ItemCardProps) {
  return (
    <div className="space-y-4">
      {children}
      {onRemove && canRemove && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onRemove}
            aria-label={ariaLabel}
            className="flex items-center gap-1.5 text-xs cursor-pointer rounded px-2 py-1.5 transition-colors duration-150 text-secondary"
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-destructive, var(--color-text-secondary))'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            <Trash2 size={14} />
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
