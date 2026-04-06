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
      {onRemove && canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={ariaLabel}
          className="float-right -mt-1 -mr-1 cursor-pointer rounded p-1 transition-colors text-secondary"
          style={{ transitionDuration: 'var(--transition-speed)' }}
        >
          <Trash2 size={14} />
        </button>
      )}
      {children}
    </div>
  )
}
