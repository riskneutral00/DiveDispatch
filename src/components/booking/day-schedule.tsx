'use client'

import { Clock, MapPin, Lock, Waves, Anchor, Footprints } from 'lucide-react'
import { GlassCard, GlassBadge, GlassInput } from '@/components/glass'
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
          className="text-sm font-semibold"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Day {dayNumber}
        </span>
        <span
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
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
                  className="text-xs font-medium"
                  style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}
                >
                  {session.isConfinedDay
                    ? 'Pool / Confined'
                    : session.deliveryLocation === 'Beach'
                      ? 'Shore / Open Water'
                      : 'Boat / Open Water'}
                </span>
                <span
                  className="flex items-center gap-1 text-xs"
                  style={{ color: 'var(--color-text-secondary)' }}
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
                  className="text-xs"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
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
              {/* Timezone selector styled to match glass inputs */}
              <div className="col-span-2 sm:col-span-1 flex flex-col gap-1.5">
                <label
                  className="text-sm font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Timezone
                </label>
                <select
                  value={session.timezone}
                  onChange={e => onUpdate(idx, 'timezone', e.target.value)}
                  className="glass text-sm px-3 py-2.5 w-full focus:outline-none focus:ring-2 rounded"
                  style={{
                    color: 'var(--color-text-primary)',
                    outlineColor: 'var(--color-accent)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dive slot chips */}
            {session.diveSlots.length > 0 && (
              <div
                className="flex flex-wrap gap-1.5 pt-2 border-t"
                style={{ borderColor: 'var(--color-glass-border)' }}
              >
                {session.diveSlots.map((slot, si) => (
                  <span
                    key={si}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                    style={{
                      background: 'var(--color-glass-bg)',
                      borderColor: 'var(--color-glass-border)',
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    <Waves size={10} />
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {slot.diverAbbrev}
                    </span>
                    &middot; Dive {slot.diveNumber}
                    {slot.isConfined && (
                      <span style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
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
