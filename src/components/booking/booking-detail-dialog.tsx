'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { Edit2, Play, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { parseConvexErrorI18n } from '@/lib/utils/convex-error'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import { Button, Dialog, EmptyState, StatusBadge } from '@/components/ui'
import { ConfirmActionDialog } from '@/components/ui/confirm-dialog'
import { courseLabel } from '@/lib/constants/course-catalog'
import { formatDateRange } from '@/lib/booking/booking-display'
import { TERMINAL_STATUSES, type CalendarDisplayStatus } from '@/lib/constants/status-colors'
import {
  useTTLCountdown,
  BookingDetailSkeleton,
  BookingDetailBody,
  type SectionId,
} from './booking-detail-shared'
import { CancelBookingDialog } from './cancel-booking-dialog'

interface BookingDetailDialogProps {
  bookingId: string | null // null = closed
  onClose: () => void
}

function DiscardDraftDialog({
  open,
  onClose,
  bookingId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  bookingId: string
  onSuccess: () => void
}) {
  const tCommon = useTranslations('common')
  const tDialogs = useTranslations('booking.dialogs')
  const tErrors = useTranslations('errors')
  const discardDraft = useMutation(api.bookingDraftMutations.discardDraft)

  async function handleConfirm() {
    try {
      await discardDraft({ bookingId: bookingId as Id<'bookings'> })
      onSuccess()
      onClose()
    } catch (err) {
      throw new Error(parseConvexErrorI18n(err, tErrors))
    }
  }

  return (
    <ConfirmActionDialog
      open={open}
      onClose={onClose}
      title={tDialogs('discardDraftTitle')}
      description={tDialogs('discardDraftBody')}
      confirmLabel={tCommon('discard')}
      cancelLabel={tDialogs('cancelKeep')}
      variant="destructive"
      onConfirm={handleConfirm}
    />
  )
}

function BookingDetailContent({
  bookingId,
  onClose,
}: {
  bookingId: string
  onClose: () => void
}) {
  const router = useRouter()
  const tEmpty = useTranslations('booking.emptyStates')
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>('overview')

  const booking = useQuery(api.bookings.getBookingDetail, {
    bookingId: bookingId as Id<'bookings'>,
  })

  const portalLink = useQuery(
    api.bookingLinks.getByBookingId,
    booking != null ? { bookingId: bookingId as Id<'bookings'> } : 'skip',
  )

  const ttlLabel = useTTLCountdown(booking?.status === 'Draft' ? booking.expiresAt : undefined)

  if (booking === undefined) return <BookingDetailSkeleton />

  if (booking === null) {
    return (
      <EmptyState message={tEmpty('bookingNotFound')} />
    )
  }

  const isDraft = booking.status === 'Draft'
  const canEdit = !TERMINAL_STATUSES.has(booking.status as CalendarDisplayStatus)
  const canCancel = !TERMINAL_STATUSES.has(booking.status as CalendarDisplayStatus)

  const overviewSlot = (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={booking.status} dot />
          {isDraft && ttlLabel && (
            <span
              className={`text-label ${ttlLabel === 'Expired' ? 'text-destructive' : 'text-secondary'}`}
            >
              {ttlLabel}
            </span>
          )}
        </div>
        <p className="text-card-title font-semibold text-primary">
          {booking.activityType.map(courseLabel).join(', ')}
        </p>
        <p className="text-body text-secondary">
          {formatDateRange(booking.startDate, booking.endDate)} ·{' '}
          {booking.divers.length} {booking.divers.length === 1 ? 'diver' : 'divers'}
        </p>
        <p className="text-label text-secondary">
          Operator: {booking.operatorName}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {isDraft ? (
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                router.push(`/booking/${bookingId}/edit`)
                onClose()
              }}
            >
              <Play size={13} />
              Resume
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDiscardDialog(true)}
            >
              <Trash2 size={13} />
              Discard
            </Button>
          </>
        ) : (
          canEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                router.push(`/booking/${bookingId}/edit`)
                onClose()
              }}
            >
              <Edit2 size={13} />
              Edit
            </Button>
          )
        )}
        {canCancel && !isDraft && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowCancelDialog(true)}
          >
            Cancel
          </Button>
        )}
      </div>
    </>
  )

  return (
    <>
      <BookingDetailBody
        booking={booking}
        bookingId={bookingId}
        portalLink={portalLink}
        layout="dialog"
        compact
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        overviewSlot={overviewSlot}
      />

      <CancelBookingDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        bookingId={bookingId as Id<'bookings'>}
        onSuccess={onClose}
      />

      {showDiscardDialog && (
        <DiscardDraftDialog
          open={showDiscardDialog}
          onClose={() => setShowDiscardDialog(false)}
          bookingId={bookingId}
          onSuccess={onClose}
        />
      )}
    </>
  )
}

export function BookingDetailDialog({ bookingId, onClose }: BookingDetailDialogProps) {
  const tDialogs = useTranslations('booking.dialogs')
  return (
    <Dialog
      open={bookingId !== null}
      onClose={onClose}
      title={tDialogs('bookingTitle')}
      fullScreen
      melt
    >
      {bookingId !== null && (
        <BookingDetailContent bookingId={bookingId} onClose={onClose} />
      )}
    </Dialog>
  )
}
