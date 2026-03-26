'use client'

import { useCallback, useState } from 'react'
import type { OperatorDefaults } from '@/lib/hooks/use-operator-defaults'
import { COURSE_TEMPLATES } from '@/components/booking/quick-book-rail'
import { buildPreFill, expandDateRange } from '@/lib/booking/compute-date-range'
import type { BookingPreFill } from '@/lib/booking/wizard-state'
import type { DropConfirmation } from '@/lib/hooks/use-drag-to-date'

// ── Types ────────────────────────────────────────────────────────────────────

interface UseQuickBookFlowReturn {
  // Overlay state
  overlayOpen: boolean
  overlayCourses: string[]
  overlayPreFill: BookingPreFill | undefined
  wizardKey: number
  openBookingOverlay: (courses?: string[], preFill?: BookingPreFill) => void
  closeOverlay: () => void

  // Armed pill (mobile tap-to-date flow)
  armedPillId: string | null
  setArmedPillId: (id: string | null) => void
  handleArmedDateClick: (
    date: string,
    requestToggle: (date: string) => void,
    setDropConfirmation: (info: DropConfirmation | null) => void,
    setAvailCheckDates: (dates: string[]) => void,
  ) => void
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages the booking overlay (wizard), armed pill state (mobile tap flow),
 * and the mobile tap-to-date booking creation flow.
 */
export function useQuickBookFlow(defaults: OperatorDefaults): UseQuickBookFlowReturn {
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [overlayCourses, setOverlayCourses] = useState<string[]>([])
  const [overlayPreFill, setOverlayPreFill] = useState<BookingPreFill | undefined>(undefined)
  const [wizardKey, setWizardKey] = useState(0)
  const [armedPillId, setArmedPillId] = useState<string | null>(null)

  const openBookingOverlay = useCallback((courses: string[] = [], preFill?: BookingPreFill) => {
    setOverlayCourses(courses)
    setOverlayPreFill(preFill)
    setWizardKey((k) => k + 1)
    setOverlayOpen(true)
  }, [])

  const closeOverlay = useCallback(() => {
    setOverlayOpen(false)
  }, [])

  const handleArmedDateClick = useCallback((
    date: string,
    requestToggle: (date: string) => void,
    setDropConfirmation: (info: DropConfirmation | null) => void,
    setAvailCheckDates: (dates: string[]) => void,
  ) => {
    if (!armedPillId) {
      // No pill armed -- normal date click (block/unblock)
      requestToggle(date)
      return
    }

    // Find the armed pill's courses
    const template = COURSE_TEMPLATES.find((t) => t.id === armedPillId)
    const courses = template?.courses ?? (armedPillId === 'plus' ? [] : [])
    const preFill = buildPreFill(courses as string[], date, defaults)
    const dates = expandDateRange(preFill.startDate, preFill.endDate)

    // Show confirmation + fire availability check
    setDropConfirmation({
      label: template?.label ?? '+ Booking',
      startDate: preFill.startDate,
      endDate: preFill.endDate,
      conflicts: null,
    })
    setAvailCheckDates(dates)

    setArmedPillId(null)
    setTimeout(() => {
      openBookingOverlay(courses as string[], preFill)
      setTimeout(() => setDropConfirmation(null), 300)
    }, 600)
  }, [armedPillId, defaults, openBookingOverlay])

  return {
    overlayOpen,
    overlayCourses,
    overlayPreFill,
    wizardKey,
    openBookingOverlay,
    closeOverlay,
    armedPillId,
    setArmedPillId,
    handleArmedDateClick,
  }
}
