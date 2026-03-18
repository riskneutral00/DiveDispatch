'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Trash2 } from 'lucide-react'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassDialog } from '@/components/glass/glass-dialog'

interface RequestActionsProps {
  reservationId: string
  bookingId: string
  inventoryUnitId: string
  confirmOnDecline?: boolean
}

export function RequestActions({
  reservationId,
  bookingId,
  inventoryUnitId,
  confirmOnDecline = false,
}: RequestActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept = useMutation(api.reservationsMutations.acceptReservation)
  const decline = useMutation(api.reservationsMutations.declineReservation)

  async function handleAccept() {
    setError(null)
    setAccepting(true)
    try {
      await accept({ reservationId: reservationId as Id<'reservations'> })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept')
    } finally {
      setAccepting(false)
    }
  }

  async function handleDecline() {
    setError(null)
    if (confirmOnDecline) {
      setConfirmOpen(true)
      return
    }
    await executeDecline()
  }

  async function executeDecline() {
    setConfirmOpen(false)
    setDeclining(true)
    try {
      await decline({
        bookingId: bookingId as Id<'bookings'>,
        inventoryUnitId: inventoryUnitId as Id<'inventoryUnits'>,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to decline')
    } finally {
      setDeclining(false)
    }
  }

  return (
    <>
      <div className="flex gap-2 items-center">
        <GlassButton
          size="sm"
          variant="primary"
          onClick={handleAccept}
          loading={accepting}
          disabled={declining}
        >
          Accept
        </GlassButton>
        <button
          type="button"
          className="p-1.5 rounded-full transition-colors"
          style={{ color: 'var(--color-destructive)' }}
          onClick={handleDecline}
          disabled={accepting || declining}
          aria-label="Decline request"
        >
          {declining ? (
            <span className="block w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-destructive)', borderTopColor: 'transparent' }} />
          ) : (
            <Trash2 size={16} />
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs mt-1" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}

      <GlassDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Decline booking?"
        description="This will release your hold. The booking owner will be notified."
        size="sm"
      >
        <div className="flex gap-2 justify-end">
          <GlassButton size="sm" variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </GlassButton>
          <GlassButton size="sm" variant="destructive" onClick={executeDecline} loading={declining}>
            Decline
          </GlassButton>
        </div>
      </GlassDialog>
    </>
  )
}
