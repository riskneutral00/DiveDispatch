'use client'

import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { Tooltip } from '@/components/ui/tooltip'
import { DraggablePill } from '@/components/booking/draggable-pill'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { COURSE_TEMPLATES } from '@/lib/booking/quick-book-templates'
import { PILL_BASE as PILL_BASE_SHELL } from '@/lib/constants/pill-shell'

export const PILL_BASE = PILL_BASE_SHELL

/** At-rest surface — see `.quick-book-pill` in globals-surfaces.css (+ Booking matches course pills) */
export const QUICK_BOOK_PILL_CLASS = 'quick-book-pill'

export const DISABLED_OVERLAY: React.CSSProperties = { opacity: 0.4, cursor: 'not-allowed' }

export interface QuickBookRailProps {
  onSelect: (courses: CourseCode[]) => void
  dragEnabled?: boolean
}

const TOOLTIP_LABEL = 'Complete your profile to create bookings'

const PLUS_TEMPLATE = { id: 'plus', label: '+ Booking', courses: [] as CourseCode[] }

export function QuickBookRail({ onSelect, dragEnabled }: QuickBookRailProps) {
  const { isLoading } = useCurrentUser()
  const onboardingStatus = useQuery(api.users.getOnboardingStatus)
  const canBook = !isLoading && onboardingStatus?.percentage === 100

  return (
    <div className="flex flex-wrap items-center justify-start gap-1.5">
      {COURSE_TEMPLATES.map((template) => {
        if (dragEnabled) {
          const pill = (
            <DraggablePill
              key={template.id}
              template={template}
              canBook={canBook}
              onSelect={onSelect}
            />
          )

          if (!canBook) {
            return (
              <Tooltip key={template.id} label={TOOLTIP_LABEL}>
                {pill}
              </Tooltip>
            )
          }

          return <span key={template.id}>{pill}</span>
        }

        const btn = (
          <button /* design-ok: pill with PILL_BASE + quick-book-pill + glass-surface + glass-surface-elevated */
            key={template.id}
            type="button"
            disabled={!canBook}
            className={`${PILL_BASE} glass-surface glass-surface-elevated ${QUICK_BOOK_PILL_CLASS} ${canBook ? 'cursor-pointer' : ''}`}
            style={canBook ? undefined : DISABLED_OVERLAY}
            onClick={canBook ? () => onSelect(template.courses) : undefined}
          >
            {template.label}
          </button>
        )

        if (!canBook) {
          return (
            <Tooltip key={template.id} label={TOOLTIP_LABEL}>
              {btn}
            </Tooltip>
          )
        }

        return <span key={template.id}>{btn}</span>
      })}

      {canBook ? (
        <span className="inline-flex ml-auto">
          {dragEnabled ? (
            <DraggablePill
              template={PLUS_TEMPLATE}
              canBook={canBook}
              onSelect={onSelect}
            />
          ) : (
            <button /* design-ok: same stack as course pills */
              type="button"
              className={`${PILL_BASE} glass-surface glass-surface-elevated ${QUICK_BOOK_PILL_CLASS} cursor-pointer`}
              onClick={() => onSelect([] as CourseCode[])}
            >
              + Booking
            </button>
          )}
        </span>
      ) : (
        <Tooltip label={TOOLTIP_LABEL} className="hidden md:inline-flex ml-auto">
          <button /* design-ok: same stack as course pills */
            type="button"
            disabled
            className={`${PILL_BASE} glass-surface glass-surface-elevated ${QUICK_BOOK_PILL_CLASS}`}
            style={DISABLED_OVERLAY}
          >
            + Booking
          </button>
        </Tooltip>
      )}
    </div>
  )
}
