'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { getConvexErrorCode, parseConvexError } from '@/lib/utils/convex-error'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_TEXTAREA_ROWS } from '@/lib/constants/form-config'
import { UNEXPECTED_ERROR_MESSAGE } from '@/lib/constants/error-messages'
import { ConfirmActionDialog } from './confirm-action-dialog'

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

  function handleClose() {
    setReason('')
    onClose()
  }

  async function handleConfirm() {
    try {
      await cancelBooking({ bookingId })
      setReason('')
      onSuccess?.()
      onClose()
    } catch (err) {
      const code = getConvexErrorCode(err)
      if (code === 'INVALID_STATUS') {
        throw new Error("Can't cancel in current status.")
      } else if (code === 'FORBIDDEN') {
        throw new Error('No permission to cancel.')
      } else {
        throw new Error(parseConvexError(err, UNEXPECTED_ERROR_MESSAGE))
      }
    }
  }

  return (
    <ConfirmActionDialog
      open={open}
      onClose={handleClose}
      title="Cancel booking"
      description="This will release all reservations. This cannot be undone."
      confirmLabel="Cancel"
      cancelLabel="Keep"
      variant="destructive"
      onConfirm={handleConfirm}
    >
      <Textarea
        label="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={DEFAULT_TEXTAREA_ROWS}
        placeholder="e.g. customer requested cancellation"
      />
    </ConfirmActionDialog>
  )
}
