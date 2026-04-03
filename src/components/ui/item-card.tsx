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
    <div className="border border-muted/30 rounded-lg p-4 relative">
      {onRemove && canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={ariaLabel}
          className="absolute top-2 right-2 cursor-pointer rounded p-1 transition-colors duration-150 text-muted-foreground hover:text-destructive"
        >
          <Trash2 size={14} />
        </button>
      )}
      {children}
    </div>
  )
}
