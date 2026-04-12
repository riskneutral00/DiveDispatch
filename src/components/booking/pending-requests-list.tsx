'use client'

import { useState, useCallback, useMemo } from 'react'
import { useMutation } from 'convex/react'
import { Check, X, Calendar } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import type { RequestItem } from '../../../convex/bookings'
import { Button } from '@/components/ui'
import { courseLabel } from '@/lib/constants/course-catalog'
import { parseConvexError } from '@/lib/utils/convex-error'
import {
  ResourceStatusList,
  type ResourceStatusItem,
} from './resource-status-list'

interface PendingRequestsListProps {
  requests: RequestItem[]
}

export function PendingRequestsList({ requests }: PendingRequestsListProps) {
  const t = useTranslations('common')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const acceptByBooking = useMutation(
    api.reservationsMutations.acceptByBookingForCaller,
  )
  const declineByBooking = useMutation(
    api.reservationsMutations.declineByBookingForCaller,
  )

  const handleAccept = useCallback(
    async (bookingId: string) => {
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
    },
    [acceptByBooking],
  )

  const handleDecline = useCallback(
    async (bookingId: string) => {
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
    },
    [declineByBooking],
  )

  const items: ResourceStatusItem[] = useMemo(
    () =>
      requests.map((req) => {
        const dateLabel =
          req.dates.length === 1
            ? req.dates[0]
            : `${req.dates[0]} — ${req.dates[req.dates.length - 1]}`
        const isBusy = busyId === req.bookingId
        return {
          id: req._id,
          primaryText: req.ownerName,
          secondaryText: `${req.activityType.map(courseLabel).join(', ')} · ${dateLabel}`,
          badge: { variant: 'warning', label: t('pending'), dot: true },
          actions: (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleAccept(req.bookingId)}
                loading={isBusy && busyAction === 'accept'}
                disabled={isBusy}
              >
                <Check size={14} />
                {t('accept')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDecline(req.bookingId)}
                loading={isBusy && busyAction === 'decline'}
                disabled={isBusy}
              >
                <X size={14} />
                {t('decline')}
              </Button>
            </>
          ),
        }
      }),
    [requests, busyId, busyAction, handleAccept, handleDecline, t],
  )

  return (
    <ResourceStatusList
      items={items}
      emptyMessageKey="emptyStates.noPendingRequests"
      namespace="booking"
      emptyIcon={Calendar}
      variant="card"
      dedupeBy={(item) =>
        requests.find((r) => r._id === item.id)?.bookingId ?? item.id
      }
      globalError={error}
    />
  )
}
