'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { serializeDraftState, type WizardState } from '@/lib/booking/wizard-state'

const DEBOUNCE_MS = 3000
const RETRY_DELAY_MS = 1000

/**
 * Debounce-saves wizard state to Convex in the background.
 * Fires 3 seconds after the last state change.
 * Retries once on failure; shows error message on second failure.
 *
 * Only one saveDraftState mutation is inflight at a time. If state changes
 * while a save is inflight, one follow-up save fires after completion.
 *
 * Exposes cancelPending() so the wizard can cancel the debounce before
 * doing an immediate navigation save — avoids redundant double-writes.
 */
export function useBookingDraftAutoSave(
  bookingId: string | null,
  state: WizardState,
): { autoSaveError: string | null; cancelPending: () => void } {
  const saveDraftState = useMutation(api.bookingDraftMutations.saveDraftState)
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRenderRef = useRef(true)
  const isSavingRef = useRef(false)
  const pendingRef = useRef(false)
  const latestStateRef = useRef(state)
  const latestBookingIdRef = useRef(bookingId)

  // Keep refs in sync with latest values
  latestStateRef.current = state
  latestBookingIdRef.current = bookingId

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const doSave = useCallback(() => {
    const currentBookingId = latestBookingIdRef.current
    if (!currentBookingId) return

    isSavingRef.current = true
    const serialized = serializeDraftState(latestStateRef.current)
    let attempts = 0

    const onComplete = () => {
      isSavingRef.current = false
      if (pendingRef.current) {
        pendingRef.current = false
        doSave()
      }
    }

    const attempt = () => {
      saveDraftState({
        bookingId: currentBookingId as Id<'bookings'>,
        draftState: serialized,
      })
        .then(() => {
          setAutoSaveError(null)
          onComplete()
        })
        .catch(() => {
          attempts++
          if (attempts < 2) {
            setTimeout(attempt, RETRY_DELAY_MS)
          } else {
            setAutoSaveError('Save failed')
            onComplete()
          }
        })
    }

    attempt()
  }, [saveDraftState])

  useEffect(() => {
    // Skip initial render — only auto-save after user changes state
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }

    if (!bookingId) return

    cancelPending()

    timerRef.current = setTimeout(() => {
      timerRef.current = null

      if (isSavingRef.current) {
        pendingRef.current = true
        return
      }

      doSave()
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [bookingId, state, saveDraftState, cancelPending, doSave])

  return { autoSaveError, cancelPending }
}
