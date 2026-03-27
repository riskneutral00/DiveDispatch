import type { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'

interface ItemCardProps {
  children: ReactNode
  onRemove?: () => void
  canRemove?: boolean
  'aria-label'?: string
}

export function ItemCard({ children, onRemove, canRemove = true, 'aria-label': ariaLabel = 'Remove item' }: ItemCardProps) {
  const showRemove = canRemove && onRemove

  return (
    <div
      className="relative rounded-[var(--border-radius,12px)] p-4 space-y-3"
      style={{
        background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
      }}
    >
      {showRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={ariaLabel}
          className="absolute top-2 right-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded transition-colors cursor-pointer"
          style={{ color: 'var(--color-destructive, var(--color-text-secondary))' }}
        >
          <Trash2 size={16} />
        </button>
      )}
      <div className={showRemove ? 'pr-10' : undefined}>
        {children}
      </div>
    </div>
  )
}
