import type { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'

interface CredentialRowProps {
  index: number
  canRemove: boolean
  onRemove: (index: number) => void
  children: ReactNode
}

/**
 * Shared credential row shell — trash button + children layout.
 * No card wrapper; parent handles dividers between rows.
 */
export function CredentialRow({ index, canRemove, onRemove, children }: CredentialRowProps) {
  return (
    <div className="relative space-y-4">
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label={`Remove credential ${index + 1}`}
          className="absolute top-0 right-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded transition-opacity duration-150 cursor-pointer"
          style={{ color: 'var(--color-destructive, var(--color-text-secondary))' }}
        >
          <Trash2 size={16} />
        </button>
      )}
      <div className={canRemove ? 'pr-10' : ''}>
        {children}
      </div>
    </div>
  )
}
