import type { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'

interface ItemCardProps {
  children: ReactNode
  onRemove?: () => void
  canRemove?: boolean
  'aria-label'?: string
}

export function ItemCard({ children, onRemove, canRemove = true, 'aria-label': ariaLabel = 'Remove item' }: ItemCardProps) {
  return (
    <div className="glass-container reading-plane rounded-theme p-4">
      <div className="flex gap-2">
        <div className="flex-1 min-w-0">{children}</div>
        {onRemove && canRemove && (
          <IconButton
            onClick={onRemove}
            variant="ghost"
            aria-label={ariaLabel}
            className="flex-shrink-0 -mt-1 -mr-1"
          >
            <Trash2 size={14} />
          </IconButton>
        )}
      </div>
    </div>
  )
}
