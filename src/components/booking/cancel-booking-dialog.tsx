'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useTranslations } from 'next-intl'
import { parseConvexErrorI18n } from '@/lib/utils/convex-error'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_TEXTAREA_ROWS } from '@/lib/constants/form-config'
import { ConfirmActionDialog } from '@/components/ui/confirm-dialog'

interface CancelBookingDialogProps {
  open: boolean
  onClose: () => void
  bookingId: Id<'bookings'>
  onSuccess?: () => void
}

export function CancelBookingDialog({
  open,
  onClose,
  bookingId,
  onSuccess,
}: CancelBookingDialogProps) {
  const tErrors = useTranslations('errors')
  const tDialogs = useTranslations('booking.dialogs')
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
      throw new Error(parseConvexErrorI18n(err, tErrors))
    }
  }

  return (
    <ConfirmActionDialog
      open={open}
      onClose={handleClose}
      title={tDialogs('cancelTitle')}
      description={tDialogs('cancelBody')}
      confirmLabel={tDialogs('cancelConfirm')}
      cancelLabel={tDialogs('cancelKeep')}
      variant="destructive"
      onConfirm={handleConfirm}
    >
      <Textarea
        label={tDialogs('cancelReasonLabel')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={DEFAULT_TEXTAREA_ROWS}
        placeholder={tDialogs('cancelReasonPlaceholder')}
      />
    </ConfirmActionDialog>
  )
}
