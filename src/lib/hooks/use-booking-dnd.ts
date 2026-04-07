'use client'

import { useCallback, useState } from 'react'
import { PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom'
import { buildPreFill } from '@/lib/booking/compute-date-range'
import { toISODateString } from '@/lib/utils/date'
import type { OperatorDefaults } from '@/lib/hooks/use-operator-defaults'
import type { QuickBookTemplate } from '@/lib/booking/quick-book-templates'
import type { BookingPreFill } from '@/lib/booking/wizard-state'

// ── Sensor config ────────────────────────────────────────────────────────────
// Distance threshold for mouse (8px) prevents click→drag conflicts.
// Delay for touch (250ms hold) prevents scroll→drag conflicts on mobile.

export const BOOKING_DND_SENSORS = [
  PointerSensor.configure({
    activationConstraints(event: PointerEvent) {
      if (event.pointerType === 'touch') {
        return [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
      }
      return [new PointerActivationConstraints.Distance({ value: 8 })]
    },
  }),
]

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseBookingDndInput {
  defaults: OperatorDefaults
  /** Optional: resources from a matching booking template (same course set). */
  resolveTemplateResourceHints?: (
    courses: string[],
  ) => Array<{ resourceType: string; resourceId: string }> | undefined
}

interface UseBookingDndReturn {
  activeTemplate: QuickBookTemplate | null
  pendingPreFill: BookingPreFill | null
  clearPendingPreFill: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- handlers match DragDropProvider's generic event signatures
  handleDragStart: (...args: any[]) => void
  handleDragEnd: (...args: any[]) => void
}

export function useBookingDnd({
  defaults,
  resolveTemplateResourceHints,
}: UseBookingDndInput): UseBookingDndReturn {
  const [activeTemplate, setActiveTemplate] = useState<QuickBookTemplate | null>(null)
  const [pendingPreFill, setPendingPreFill] = useState<BookingPreFill | null>(null)

  const handleDragStart = useCallback(
    (event: { operation: { source?: { data?: Record<string, unknown> } } }) => {
      const data = event.operation.source?.data as { type?: string; template?: QuickBookTemplate } | undefined
      if (data?.type === 'quick-book-pill' && data.template) {
        setActiveTemplate(data.template)
      }
    },
    [],
  )

  const handleDragEnd = useCallback(
    (event: { operation: { source?: { data?: Record<string, unknown> }; target?: { data?: Record<string, unknown> } } }) => {
      setActiveTemplate(null)

      const sourceData = event.operation.source?.data as { type?: string; template?: QuickBookTemplate } | undefined
      const targetData = event.operation.target?.data as { type?: string; date?: string } | undefined

      if (sourceData?.type !== 'quick-book-pill' || targetData?.type !== 'calendar-date') return

      const date = targetData.date
      const template = sourceData.template
      if (!date || !template) return

      // Reject past dates
      const today = toISODateString(new Date())
      if (date < today) return

      const courses = template.courses as string[]
      const hints = resolveTemplateResourceHints?.(courses)
      const preFill = buildPreFill(courses, date, defaults, hints)
      setPendingPreFill(preFill)
    },
    [defaults, resolveTemplateResourceHints],
  )

  const clearPendingPreFill = useCallback(() => {
    setPendingPreFill(null)
  }, [])

  return {
    activeTemplate,
    pendingPreFill,
    clearPendingPreFill,
    handleDragStart,
    handleDragEnd,
  }
}
