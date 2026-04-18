import type { ReactNode } from 'react'
import { Trash2, Save, Check, Loader2 } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/lib/utils/cn'

interface ItemCardProps {
  children: ReactNode
  onRemove?: () => void
  canRemove?: boolean
  onSave?: () => void
  canSave?: boolean
  saving?: boolean
  saved?: boolean
  'aria-label'?: string
  'save-aria-label'?: string
  surface?: 'tinted' | 'plain'
}

export function ItemCard({
  children,
  onRemove,
  canRemove = true,
  onSave,
  canSave = true,
  saving = false,
  saved = false,
  'aria-label': ariaLabel = 'Remove item',
  'save-aria-label': saveAriaLabel = 'Save item',
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
        {onSave && (
          <IconButton
            onClick={onSave}
            variant="ghost"
            aria-label={saveAriaLabel}
            disabled={!canSave || saving}
            className="flex-shrink-0 -mt-1"
            style={saved ? { background: 'var(--color-active-fg)', borderColor: 'var(--color-active-fg)' } : undefined}
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saved ? (
              <Check size={14} className="text-on-primary" />
            ) : (
              <Save size={14} />
            )}
          </IconButton>
        )}
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
