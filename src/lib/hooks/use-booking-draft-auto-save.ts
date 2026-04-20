'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import { serializeDraftState, type WizardState } from '@/lib/booking/wizard-state'

const DEBOUNCE_MS = 3000
const RETRY_DELAY_MS = 1000

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

  /* eslint-disable-next-line react-hooks/refs -- comments-ok mirror-ref for latest props captured inside debounced effect closure */
  latestStateRef.current = state
  /* eslint-disable-next-line react-hooks/refs -- comments-ok mirror-ref for latest props captured inside debounced effect closure */
  latestBookingIdRef.current = bookingId

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const doSaveRef = useRef<(() => void) | null>(null)

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
        doSaveRef.current?.()
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

  /* eslint-disable-next-line react-hooks/refs -- comments-ok breaks doSave self-reference cycle flagged by react-hooks/immutability */
  doSaveRef.current = doSave

  useEffect(() => {
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
