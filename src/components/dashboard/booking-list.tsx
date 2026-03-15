'use client'

import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { Users, Calendar, ChevronDown } from 'lucide-react'
import { GlassCard, GlassBadge, GlassButton, GlassDialog } from '@/components/glass'
import { useStableQuery } from '@/lib/hooks/use-stable-query'
import { BookingCalendar } from './booking-calendar'
import type { CalendarBooking } from '../../../convex/bookings'
import type { ClerkRole } from '@/lib/constants/roles'

interface BookingListProps {
  ownerId: string
  ownerType: ClerkRole
}

type StatusFilter = 'All' | 'Draft' | 'Upcoming' | 'Completed' | 'Cancelled'
type SortKey = 'startDate' | 'status'

type OperatorType =
  | 'DiveCenter'
  | 'Agent'
  | 'Liveaboard'
  | 'DiveResort'
  | 'DiveHostel'
  | 'DiveSite'

const STATUS_FILTERS: StatusFilter[] = ['All', 'Draft', 'Upcoming', 'Completed', 'Cancelled']

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
  Draft: 'default',
  Upcoming: 'success',
  Completed: 'info',
  Cancelled: 'destructive',
}

const OPERATOR_TYPES = new Set<string>([
  'DiveCenter', 'Agent', 'Liveaboard', 'DiveResort', 'DiveHostel', 'DiveSite',
])

export function BookingList({ ownerId, ownerType }: BookingListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [sortKey, setSortKey] = useState<SortKey>('startDate')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [detailBooking, setDetailBooking] = useState<CalendarBooking | null>(null)

  const isOperator = OPERATOR_TYPES.has(ownerType)

  const { data: bookings, isLoading, isError } = useStableQuery(
    api.bookings.listByOwner,
    isOperator ? { ownerId, ownerType: ownerType as OperatorType } : 'skip',
  )

  if (!isOperator) return null

  if (isError) {
    return (
      <GlassCard padding="md">
        <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
          Unable to load bookings.{' '}
          <a href="/role-select" className="underline" style={{ color: 'var(--color-primary)' }}>
            Set up your account
          </a>
        </p>
      </GlassCard>
    )
  }

  if (isLoading || !bookings) {
    return (
      <GlassCard padding="md">
        <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
          Loading bookings…
        </p>
      </GlassCard>
    )
  }

  let filtered = bookings
  if (statusFilter !== 'All') {
    filtered = filtered.filter((b) => b.status === statusFilter)
  }
  if (selectedDate) {
    filtered = filtered.filter(
      (b) => b.startDate <= selectedDate && b.endDate >= selectedDate,
    )
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'startDate') return a.startDate.localeCompare(b.startDate)
    return a.status.localeCompare(b.status)
  })

  return (
    <div className="space-y-4">
      {/* Calendar timeline */}
      <GlassCard padding="md">
        <BookingCalendar
          bookings={bookings}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </GlassCard>

      {/* Filters + sort */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
              style={{
                background: statusFilter === s ? 'var(--color-primary)' : 'var(--color-glass-bg)',
                color: statusFilter === s ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                borderColor: statusFilter === s ? 'var(--color-primary)' : 'var(--color-glass-border)',
                transitionDuration: 'var(--transition-speed)',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSortKey(sortKey === 'startDate' ? 'status' : 'startDate')}
          className="flex items-center gap-1 text-xs px-3 py-1 rounded-full border"
          style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-glass-border)', background: 'var(--color-glass-bg)' }}
        >
          <ChevronDown size={12} />
          Sort: {sortKey === 'startDate' ? 'Date' : 'Status'}
        </button>
      </div>

      {/* Booking rows */}
      {sorted.length === 0 ? (
        <GlassCard padding="md">
          <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
            No bookings match the current filter.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {sorted.map((b) => (
            <button
              key={b._id}
              className="w-full text-left"
              onClick={() => setDetailBooking(b)}
            >
            <GlassCard
              padding="sm"
              hoverable
            >
              <div className="flex items-center gap-3">
                <GlassBadge variant={STATUS_VARIANT[b.status] ?? 'default'} size="sm" dot>
                  {b.status}
                </GlassBadge>

                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {b.activityType.join(', ')}
                  </p>
                  <div className="flex gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      <Calendar size={11} />
                      {b.startDate}
                    </span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      <Users size={11} />
                      {b.diverCount}
                    </span>
                  </div>
                </div>

                {b.instructorName && (
                  <p className="text-xs hidden sm:block" style={{ color: 'var(--color-text-secondary)' }}>
                    {b.instructorName}
                  </p>
                )}
              </div>
            </GlassCard>
            </button>
          ))}
        </div>
      )}

      {/* Detail sheet */}
      <GlassDialog
        open={detailBooking !== null}
        onClose={() => setDetailBooking(null)}
        title={detailBooking?.activityType.join(', ') ?? ''}
        size="lg"
      >
        {detailBooking && (
          <div className="space-y-4">
            <GlassBadge
              variant={STATUS_VARIANT[detailBooking.status] ?? 'default'}
              dot
            >
              {detailBooking.status}
            </GlassBadge>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-secondary)' }}>Dates</p>
                <p style={{ color: 'var(--color-text-primary)' }}>
                  {detailBooking.startDate}
                  {detailBooking.endDate !== detailBooking.startDate && ` → ${detailBooking.endDate}`}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-secondary)' }}>Divers</p>
                <p style={{ color: 'var(--color-text-primary)' }}>{detailBooking.diverCount}</p>
              </div>
              {detailBooking.instructorName && (
                <div>
                  <p className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-secondary)' }}>Instructor</p>
                  <p style={{ color: 'var(--color-text-primary)' }}>{detailBooking.instructorName}</p>
                </div>
              )}
              {detailBooking.boatName && (
                <div>
                  <p className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-secondary)' }}>Boat</p>
                  <p style={{ color: 'var(--color-text-primary)' }}>{detailBooking.boatName}</p>
                </div>
              )}
              {detailBooking.customerName && (
                <div>
                  <p className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-secondary)' }}>Lead Diver</p>
                  <p style={{ color: 'var(--color-text-primary)' }}>{detailBooking.customerName}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <GlassButton size="sm" variant="secondary" onClick={() => setDetailBooking(null)}>
                Close
              </GlassButton>
            </div>
          </div>
        )}
      </GlassDialog>
    </div>
  )
}
