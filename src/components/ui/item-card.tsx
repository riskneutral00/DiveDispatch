import type { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/lib/utils/cn'

interface ItemCardProps {
  children: ReactNode
  onRemove?: () => void
  canRemove?: boolean
  'aria-label'?: string
  /** Default `tinted` keeps the reading-plane fill; `plain` is border/perimeter only. */
  surface?: 'tinted' | 'plain'
}

export function ItemCard({
  children,
  onRemove,
  canRemove = true,
  'aria-label': ariaLabel = 'Remove item',
  surface = 'tinted',
}: ItemCardProps) {
  return (
    <div
      className={cn(
        'glass-container rounded-theme p-4',
        surface === 'tinted' && 'reading-plane',
      )}
    >
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
