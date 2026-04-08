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
    <div className="glass-container rounded-theme p-4">
      <div className="flex gap-2">
        <div className="flex-1 min-w-0">{children}</div>
        {onRemove && canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={ariaLabel}
            className="flex-shrink-0 -mt-1 -mr-1 cursor-pointer rounded-[var(--border-radius-button)] p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors duration-theme text-secondary hover:opacity-70"
            style={{ transitionDuration: 'var(--transition-speed)' }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
