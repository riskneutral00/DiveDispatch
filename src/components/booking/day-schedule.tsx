'use client'

import { Clock, MapPin, Lock, Waves, Anchor, Footprints } from 'lucide-react'
import { GlassCard, GlassBadge, GlassInput, GlassSimpleSelect } from '@/components/glass'
import type { ScheduledSession, Venue } from '@/lib/booking/session-builder'
import { VenueToggle } from './venue-toggle'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayScheduleProps {
  date: string
  dayNumber: number
  sessions: ScheduledSession[]
  onUpdate: (sessionIndex: number, field: 'startTime' | 'endTime' | 'timezone', value: string) => void
  onVenueChange?: (sessionIndex: number, venue: Venue) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Extracted from map-loop inline styles — one allocation, shared by all renders. */
const HEADING_FONT_STYLE: React.CSSProperties = { fontFamily: 'var(--font-heading)' }
const BODY_FONT_STYLE: React.CSSProperties = { fontFamily: 'var(--font-body)' }
const TZ_SELECT_STYLE: React.CSSProperties = { outlineColor: 'var(--color-accent)', fontFamily: 'var(--font-body)' }
const CHIP_BORDER_STYLE: React.CSSProperties = { borderColor: 'var(--color-glass-border)' }
const CHIP_STYLE: React.CSSProperties = { background: 'var(--color-glass-bg)', borderColor: 'var(--color-glass-border)', fontFamily: 'var(--font-body)' }
const CHIP_NAME_STYLE: React.CSSProperties = { fontWeight: 500 }
const CHIP_CONFINED_STYLE: React.CSSProperties = { color: 'var(--color-secondary)', fontWeight: 600 }

const TIMEZONES = [
  { value: 'Asia/Bangkok', label: 'ICT (UTC+7)' },
  { value: 'Asia/Singapore', label: 'SGT (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'JST (UTC+9)' },
  { value: 'Australia/Sydney', label: 'AEDT (UTC+11)' },
  { value: 'Europe/London', label: 'GMT (UTC+0)' },
  { value: 'America/New_York', label: 'EST (UTC-5)' },
  { value: 'America/Los_Angeles', label: 'PST (UTC-8)' },
  { value: 'Pacific/Honolulu', label: 'HST (UTC-10)' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DaySchedule({ date, dayNumber, sessions, onUpdate, onVenueChange }: DayScheduleProps) {
  return (
    <div className="mb-5">
      {/* Day header */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span
          className="text-sm font-semibold text-primary"
          style={HEADING_FONT_STYLE}
        >
          Day {dayNumber}
        </span>
        <span
          className="text-sm text-secondary"
          style={BODY_FONT_STYLE}
        >
          {formatDisplayDate(date)}
        </span>
        {sessions.some(s => s.isConfinedDay) && (
          <GlassBadge variant="info" size="sm" dot>
            <Lock size={10} />
            Confined Water
          </GlassBadge>
        )}
        {sessions.some(s => !s.isConfinedDay && s.resourceType === 'boat') && (
          <GlassBadge variant="success" size="sm" dot>
            Open Water
          </GlassBadge>
        )}
      </div>

      {/* Session cards */}
      {sessions.map((session, idx) => (
        <GlassCard key={idx} padding="sm" className="mb-2">
          <div className="flex flex-col gap-3">
            {/* Location row */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {session.isConfinedDay ? (
                  <Lock size={14} style={{ color: 'var(--color-secondary)' }} />
                ) : session.deliveryLocation === 'Beach' ? (
                  <Footprints size={14} style={{ color: 'var(--color-accent)' }} />
                ) : (
                  <Anchor size={14} style={{ color: 'var(--color-accent)' }} />
                )}
                <span
                  className="text-xs font-medium text-primary"
                  style={BODY_FONT_STYLE}
                >
                  {session.isConfinedDay
                    ? 'Pool / Confined'
                    : session.deliveryLocation === 'Beach'
                      ? 'Shore / Open Water'
                      : 'Boat / Open Water'}
                </span>
                <span
                  className="flex items-center gap-1 text-xs text-secondary"
                >
                  <MapPin size={11} />
                  {session.deliveryLocation === 'BoatPier'
                    ? 'Boat Pier'
                    : session.deliveryLocation}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!session.isConfinedDay && onVenueChange && (
                  <VenueToggle
                    value={session.deliveryLocation === 'Beach' ? 'Shore' : 'Boat'}
                    onChange={v => onVenueChange(idx, v)}
                  />
                )}
                <span
                  className="text-xs text-secondary"
                  style={BODY_FONT_STYLE}
                >
                  {session.unitsRequested} diver{session.unitsRequested !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Time + timezone inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <GlassInput
                label="Start time"
                type="time"
                value={session.startTime}
                onChange={e => onUpdate(idx, 'startTime', e.target.value)}
                leadingIcon={<Clock size={13} />}
              />
              <GlassInput
                label="End time"
                type="time"
                value={session.endTime}
                onChange={e => onUpdate(idx, 'endTime', e.target.value)}
                leadingIcon={<Clock size={13} />}
              />
              {/* Timezone selector */}
              <div className="col-span-2 sm:col-span-1">
                <GlassSimpleSelect
                  label="Timezone"
                  value={session.timezone}
                  onChange={v => onUpdate(idx, 'timezone', v)}
                  options={TIMEZONES}
                />
              </div>
            </div>

            {/* Dive slot chips */}
            {session.diveSlots.length > 0 && (
              <div
                className="flex flex-wrap gap-1.5 pt-2 border-t"
                style={CHIP_BORDER_STYLE}
              >
                {session.diveSlots.map((slot, si) => (
                  <span
                    key={si}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border text-secondary"
                    style={CHIP_STYLE}
                  >
                    <Waves size={10} />
                    <span className="text-primary" style={CHIP_NAME_STYLE}>
                      {slot.diverAbbrev}
                    </span>
                    &middot; Dive {slot.diveNumber}
                    {slot.isConfined && (
                      <span style={CHIP_CONFINED_STYLE}>
                        {' '}
                        C
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      ))}
    </div>
  )
}
