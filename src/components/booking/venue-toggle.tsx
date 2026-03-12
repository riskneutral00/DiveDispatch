'use client'

import { Anchor, Footprints } from 'lucide-react'
import type { Venue } from '@/lib/booking/session-builder'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VenueToggleProps {
  value: Venue
  onChange: (value: Venue) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VenueToggle({ value, onChange }: VenueToggleProps) {
  return (
    <div
      className="inline-flex overflow-hidden border rounded-[var(--border-radius)]"
      style={{ borderColor: 'var(--color-glass-border)' }}
      role="group"
      aria-label="Venue type"
    >
      <button
        type="button"
        onClick={() => onChange('Boat')}
        aria-pressed={value === 'Boat'}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all"
        style={{
          background: value === 'Boat' ? 'var(--color-accent)' : 'var(--color-glass-bg)',
          color: value === 'Boat' ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body)',
          transitionDuration: 'var(--transition-speed)',
        }}
      >
        <Anchor size={11} />
        Boat
      </button>
      <button
        type="button"
        onClick={() => onChange('Shore')}
        aria-pressed={value === 'Shore'}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all border-l"
        style={{
          background: value === 'Shore' ? 'var(--color-accent)' : 'var(--color-glass-bg)',
          color: value === 'Shore' ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
          borderColor: 'var(--color-glass-border)',
          fontFamily: 'var(--font-body)',
          transitionDuration: 'var(--transition-speed)',
        }}
      >
        <Footprints size={11} />
        Shore
      </button>
    </div>
  )
}
