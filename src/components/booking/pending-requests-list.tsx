'use client'

import { useState, useCallback } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import type { RequestItem } from '../../../convex/bookings'
import { Card, Button, Badge, ErrorAlert, EmptyState } from '@/components/ui'
import { courseLabel } from '@/lib/constants/course-catalog'
import { Check, X, Calendar } from 'lucide-react'
import { parseConvexError } from '@/lib/utils/convex-error'

interface PendingRequestsListProps {
  requests: RequestItem[]
}

export function PendingRequestsList({ requests }: PendingRequestsListProps) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const acceptByBooking = useMutation(api.reservationsMutations.acceptByBookingForCaller)
  const declineByBooking = useMutation(api.reservationsMutations.declineByBookingForCaller)

  const handleAccept = useCallback(async (bookingId: string) => {
    setError(null)
    setBusyId(bookingId)
    setBusyAction('accept')
    try {
      await acceptByBooking({ bookingId: bookingId as Id<'bookings'> })
    } catch (e) {
      setError(parseConvexError(e, 'Failed to accept'))
    } finally {
      setBusyId(null)
      setBusyAction(null)
    }
  }, [acceptByBooking])

  const handleDecline = useCallback(async (bookingId: string) => {
    setError(null)
    setBusyId(bookingId)
    setBusyAction('decline')
    try {
      await declineByBooking({ bookingId: bookingId as Id<'bookings'> })
    } catch (e) {
      setError(parseConvexError(e, 'Failed to decline'))
    } finally {
      setBusyId(null)
      setBusyAction(null)
    }
  }, [declineByBooking])

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        message="No pending requests yet."
      />
    )
  }

  // Deduplicate by bookingId (multi-day bookings may produce multiple request items)
  const seen = new Set<string>()
  const unique = requests.filter((r) => {
    if (seen.has(r.bookingId)) return false
    seen.add(r.bookingId)
    return true
  })

  return (
    <div className="space-y-2">
      {error && <ErrorAlert size="sm">{error}</ErrorAlert>}
      {unique.map((req) => {
        const isBusy = busyId === req.bookingId
        const dateLabel = req.dates.length === 1
          ? req.dates[0]
          : `${req.dates[0]} — ${req.dates[req.dates.length - 1]}`

        return (
          <Card key={req._id} padding="sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-body font-medium text-primary truncate">
                    {req.ownerName}
                  </p>
                  <Badge variant="warning" size="sm" dot>
                    Pending
                  </Badge>
                </div>
                <p className="text-label text-secondary">
                  {req.activityType.map(courseLabel).join(', ')} · {dateLabel}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleAccept(req.bookingId)}
                  loading={isBusy && busyAction === 'accept'}
                  disabled={isBusy}
                >
                  <Check size={14} />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDecline(req.bookingId)}
                  loading={isBusy && busyAction === 'decline'}
                  disabled={isBusy}
                >
                  <X size={14} />
                  Decline
                </Button>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
