'use client'

import type { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'

interface CredentialRowProps {
  index: number
  canRemove: boolean
  onRemove: (index: number) => void
  children: ReactNode
}

/**
 * Shared credential row shell — header with "Credential N" title,
 * optional remove button, and a GlassCard wrapper.
 * Inner fields (agency, level, courses, etc.) are passed as children.
 */
export function CredentialRow({ index, canRemove, onRemove, children }: CredentialRowProps) {
  return (
    <GlassCard padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
          Credential {index + 1}
        </h3>
        {canRemove && (
          <GlassButton variant="destructive" size="sm" type="button" onClick={() => onRemove(index)} aria-label={`Remove credential ${index + 1}`}>
            <Trash2 size={14} />
            Remove
          </GlassButton>
        )}
      </div>
      {children}
    </GlassCard>
  )
}
