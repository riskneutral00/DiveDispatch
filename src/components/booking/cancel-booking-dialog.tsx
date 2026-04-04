'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { getConvexErrorCode, parseConvexError } from '@/lib/utils/convex-error'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/error-alert'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_TEXTAREA_ROWS } from '@/lib/constants/form-config'
import { UNEXPECTED_ERROR_MESSAGE } from '@/lib/constants/error-messages'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CancelBookingDialogProps {
  open: boolean
  onClose: () => void
  bookingId: Id<'bookings'>
  onSuccess?: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CancelBookingDialog({
  open,
  onClose,
  bookingId,
  onSuccess,
}: CancelBookingDialogProps) {
  const cancelBooking = useMutation(api.bookings.status.cancelBooking)

  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    if (submitting) return
    setReason('')
    setError(null)
    onClose()
  }

  async function handleConfirm() {
    setError(null)
    setSubmitting(true)
    try {
      await cancelBooking({ bookingId })
      setReason('')
      onSuccess?.()
      onClose()
    } catch (err) {
      const code = getConvexErrorCode(err)
      if (code === 'INVALID_STATUS') {
        setError('This booking cannot be cancelled in its current status.')
      } else if (code === 'FORBIDDEN') {
        setError('You do not have permission to cancel this booking.')
      } else {
        setError(parseConvexError(err, UNEXPECTED_ERROR_MESSAGE))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Cancel booking"
      description="This cannot be undone. All reservations will be released."
      size="sm"
    >
      <div className="flex flex-col gap-4">
        {/* Reason field */}
        <Textarea
          label="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={submitting}
          rows={DEFAULT_TEXTAREA_ROWS}
          placeholder="e.g. Customer requested cancellation"
        />

        {/* Inline error */}
        {error && <ErrorAlert>{error}</ErrorAlert>}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-1">
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={submitting}>
            Keep booking
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            loading={submitting}
          >
            Cancel booking
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
