'use client'

import { useState } from 'react'
import {
  VENUE_SIGNUP_INTENT_STORAGE_KEY,
  type VenueSignupIntent,
} from '@/lib/constants/signup-role-tiles'

const VALID_INTENTS: ReadonlySet<string> = new Set(['pool', 'dive_site'])

function readStoredIntent(): VenueSignupIntent | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(VENUE_SIGNUP_INTENT_STORAGE_KEY)
  return raw && VALID_INTENTS.has(raw) ? (raw as VenueSignupIntent) : null
}

export function useVenueSignupIntent(): VenueSignupIntent | null {
  const [intent] = useState<VenueSignupIntent | null>(() => readStoredIntent())
  return intent
}

export function clearStoredVenueSignupIntent(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(VENUE_SIGNUP_INTENT_STORAGE_KEY)
}
