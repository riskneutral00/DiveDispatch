'use client'

import { useState, type ReactNode } from 'react'
import { Lock } from 'lucide-react'

// ── PillToggle ──────────────────────────────────────────────────────────────

interface PillToggleProps {
  label: string
  checked: boolean
  onChange: () => void
  locked?: boolean
  disabled?: boolean
}

export function PillToggle({ label, checked, onChange, locked, disabled }: PillToggleProps) {
  return (
    <label
      className={`inline-flex items-center gap-1 px-2.5 min-h-[44px] rounded-full text-xs font-medium transition-all ${locked ? 'cursor-default' : 'cursor-pointer'}`}
      style={{
        background: checked ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
        color: checked ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
        border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-glass-border)'}`,
        transitionDuration: 'var(--transition-speed)',
      }}
      aria-disabled={locked || undefined}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={locked || disabled}
        onChange={onChange}
      />
      {label}
      {locked && <Lock size={10} style={{ opacity: 0.7 }} />}
    </label>
  )
}

// ── PillToggleGroup ─────────────────────────────────────────────────────────

interface PillToggleGroupProps {
  children: ReactNode
  /** Items beyond this threshold are hidden behind "More..." */
  overflowItems?: ReactNode
}

export function PillToggleGroup({ children, overflowItems }: PillToggleGroupProps) {
  const [showMore, setShowMore] = useState(false)

  return (
    <div className="flex flex-wrap gap-1.5">
      {children}
      {overflowItems && !showMore && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="inline-flex items-center px-2.5 min-h-[44px] rounded-full text-xs font-medium cursor-pointer"
          style={{
            background: 'var(--color-surface-elevated)',
            color: 'var(--color-text-secondary)',
            border: '1px dashed var(--color-glass-border)',
          }}
        >
          More…
        </button>
      )}
      {showMore && overflowItems}
    </div>
  )
}
