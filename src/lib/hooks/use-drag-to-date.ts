'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import type { OperatorDefaults } from '@/lib/hooks/use-operator-defaults'
import type { PillDragData } from '@/lib/booking/quick-book-templates'
import { buildPreFill, expandDateRange } from '@/lib/booking/compute-date-range'
import type { BookingPreFill } from '@/lib/booking/wizard-state'
import { api } from '../../../convex/_generated/api'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DropConfirmation {
  label: string
  startDate: string
  endDate: string
  conflicts: Record<string, { slug: string; available: boolean }[]> | null
}

interface UseDragToDateReturn {
  isDragging: boolean
  dragLabel: string | null
  dropConfirmation: DropConfirmation | null
  setDropConfirmation: (info: DropConfirmation | null) => void
  availCheckDates: string[]
  setAvailCheckDates: (dates: string[]) => void
  handleDragStart: (event: DragStartEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
  handleDragCancel: () => void
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages drag-and-drop state for the quick-book pill -> calendar date flow.
 * Also owns the drop confirmation overlay + availability check state,
 * which is shared with the mobile armed-pill tap flow.
 */
export function useDragToDate(
  defaults: OperatorDefaults,
  onDrop: (courses: string[], preFill: BookingPreFill) => void,
  onClearArmedPill: () => void,
): UseDragToDateReturn {
  const [isDragging, setIsDragging] = useState(false)
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const [dropConfirmation, setDropConfirmation] = useState<DropConfirmation | null>(null)
  const [availCheckDates, setAvailCheckDates] = useState<string[]>([])

  const preferredSlugs = useMemo(() => ({
    instructor: defaults.preferredInstructorSlug ? [defaults.preferredInstructorSlug] : [],
    venue: defaults.preferredVenueSlug ? [defaults.preferredVenueSlug] : [],
    boat: defaults.preferredBoatSlug ? [defaults.preferredBoatSlug] : [],
    equipment: defaults.preferredEquipmentSlug ? [defaults.preferredEquipmentSlug] : [],
    compressor: defaults.preferredCompressorSlug ? [defaults.preferredCompressorSlug] : [],
  }), [defaults])

  const availabilityResult = useQuery(
    api.availability.checkPreferredAvailability,
    availCheckDates.length > 0
      ? { dates: availCheckDates, preferredSlugs }
      : 'skip',
  )

  // When availability result comes back, update the confirmation overlay
  useEffect(() => {
    if (dropConfirmation && !dropConfirmation.conflicts && availabilityResult) {
      setDropConfirmation({ ...dropConfirmation, conflicts: availabilityResult })
    }
  }, [availabilityResult, dropConfirmation])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as PillDragData | undefined
    if (data?.type !== 'quick-book-pill') return
    setIsDragging(true)
    setDragLabel(data.label)
    onClearArmedPill()
  }, [onClearArmedPill])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setIsDragging(false)
    setDragLabel(null)

    const pillData = event.active.data.current as PillDragData | undefined
    const dropData = event.over?.data.current as { type: string; date: string } | undefined

    if (pillData?.type !== 'quick-book-pill' || dropData?.type !== 'calendar-date') return

    const date = dropData.date
    const courses = pillData.courses as string[]
    const preFill = buildPreFill(courses, date, defaults)
    const dates = expandDateRange(preFill.startDate, preFill.endDate)

    // Show confirmation overlay + fire async availability check
    setDropConfirmation({
      label: pillData.label,
      startDate: preFill.startDate,
      endDate: preFill.endDate,
      conflicts: null,
    })
    setAvailCheckDates(dates)

    // Open wizard after brief delay (let confirmation flash)
    setTimeout(() => {
      onDrop(courses, preFill)
      setTimeout(() => setDropConfirmation(null), 300)
    }, 600)
  }, [defaults, onDrop])

  const handleDragCancel = useCallback(() => {
    setIsDragging(false)
    setDragLabel(null)
  }, [])

  return {
    isDragging,
    dragLabel,
    dropConfirmation,
    setDropConfirmation,
    availCheckDates,
    setAvailCheckDates,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  }
}
