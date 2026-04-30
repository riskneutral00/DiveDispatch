'use client'

import { useEffect, useState } from 'react'
import {
  VENUE_SIGNUP_INTENT_STORAGE_KEY,
  type VenueSignupIntent,
} from '@/lib/constants/signup-role-tiles'

const VALID_INTENTS: ReadonlySet<string> = new Set(['pool', 'dive_site', 'multi'])

function readAndClear(): VenueSignupIntent | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(VENUE_SIGNUP_INTENT_STORAGE_KEY)
  if (!raw || !VALID_INTENTS.has(raw)) {
    window.sessionStorage.removeItem(VENUE_SIGNUP_INTENT_STORAGE_KEY)
    return null
  }
  window.sessionStorage.removeItem(VENUE_SIGNUP_INTENT_STORAGE_KEY)
  return raw as VenueSignupIntent
}

export function useVenueSignupIntent(): VenueSignupIntent | null {
  const [intent, setIntent] = useState<VenueSignupIntent | null>(null)
  const [consumed, setConsumed] = useState(false)
  useEffect(() => {
    if (consumed) return
    setIntent(readAndClear())
    setConsumed(true)
  }, [consumed])
  return intent
}
