'use client'

import { Anchor, Footprints } from 'lucide-react'
import { ButtonGroup } from '@/components/ui/button-group'
import type { Venue } from '@/lib/booking/session-builder'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VenueToggleProps {
  value: Venue
  onChange: (value: Venue) => void
}

const VENUE_OPTIONS = [
  { value: 'Boat', label: <><Anchor size={11} /> Boat</> },
  { value: 'Shore', label: <><Footprints size={11} /> Shore</> },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function VenueToggle({ value, onChange }: VenueToggleProps) {
  return (
    <ButtonGroup
      options={VENUE_OPTIONS}
      value={value}
      onChange={(v) => onChange(v as Venue)}
      variant="segment"
      size="sm"
      aria-label="Venue type"
    />
  )
}
