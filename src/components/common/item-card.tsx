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
    <div className="relative space-y-4">
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={ariaLabel}
          aria-hidden={!canRemove}
          tabIndex={canRemove ? 0 : -1}
          className={`absolute top-2 right-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded transition-opacity duration-150 cursor-pointer ${
            canRemove ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ color: 'var(--color-destructive, var(--color-text-secondary))' }}
        >
          <Trash2 size={16} />
        </button>
      )}
      <div className={`space-y-4${onRemove ? ' pr-10' : ''}`}>
        {children}
      </div>
    </div>
  )
}
