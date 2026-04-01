'use client'

import {
  useReducer,
  useRef,
  type Dispatch,
  type MutableRefObject,
} from 'react'
import {
  wizardReducer,
  makeInitialState,
  type WizardState,
  type WizardAction,
} from '@/lib/booking/wizard-state'

export function useBookingWizardModel(initialBookingId: string | undefined): {
  state: WizardState
  dispatch: Dispatch<WizardAction>
  initializedRef: MutableRefObject<boolean>
} {
  const [state, dispatch] = useReducer(
    wizardReducer,
    makeInitialState(initialBookingId ?? null),
  )
  const initializedRef = useRef(false)
  return { state, dispatch, initializedRef }
}
