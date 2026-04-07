'use client'

import { useCallback, useState } from 'react'
import { PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom'
import { buildPreFill } from '@/lib/booking/compute-date-range'
import { toISODateString } from '@/lib/utils/date'
import type { OperatorDefaults } from '@/lib/hooks/use-operator-defaults'
import type { QuickBookTemplate } from '@/lib/booking/quick-book-templates'
import type { BookingPreFill } from '@/lib/booking/wizard-state'

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

interface UseBookingDndInput {
  defaults: OperatorDefaults
  resolveTemplateResourceHints?: (
    courses: string[],
  ) => Array<{ resourceType: string; resourceId: string }> | undefined
}

interface DndOperationEvent {
  operation: {
    source?: { data?: Record<string, unknown> } | null
    target?: { data?: Record<string, unknown> } | null
  }
}

interface UseBookingDndReturn {
  activeTemplate: QuickBookTemplate | null
  pendingPreFill: BookingPreFill | null
  clearPendingPreFill: () => void
  handleDragStart: (event: DndOperationEvent) => void
  handleDragEnd: (event: DndOperationEvent) => void
}

export function useBookingDnd({
  defaults,
  resolveTemplateResourceHints,
}: UseBookingDndInput): UseBookingDndReturn {
  const [activeTemplate, setActiveTemplate] = useState<QuickBookTemplate | null>(null)
  const [pendingPreFill, setPendingPreFill] = useState<BookingPreFill | null>(null)

  const handleDragStart = useCallback(
    (event: DndOperationEvent) => {
      const data = event.operation.source?.data as { type?: string; template?: QuickBookTemplate } | undefined
      if (data?.type === 'quick-book-pill' && data.template) {
        setActiveTemplate(data.template)
      }
    },
    [],
  )

  const handleDragEnd = useCallback(
    (event: DndOperationEvent) => {
      setActiveTemplate(null)

      const sourceData = event.operation.source?.data as { type?: string; template?: QuickBookTemplate } | undefined
      const targetData = event.operation.target?.data as { type?: string; date?: string } | undefined

      if (sourceData?.type !== 'quick-book-pill' || targetData?.type !== 'calendar-date') return

      const date = targetData.date
      const template = sourceData.template
      if (!date || !template) return

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
