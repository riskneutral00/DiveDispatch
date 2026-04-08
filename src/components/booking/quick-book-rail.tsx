'use client'

import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { Tooltip } from '@/components/ui/tooltip'
import { DraggablePill } from '@/components/booking/draggable-pill'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { COURSE_TEMPLATES } from '@/lib/booking/quick-book-templates'

export const PILL_BASE = 'rounded-full px-3 py-1 font-medium select-none transition-all duration-theme focus:outline-none focus-visible:ring-2'
export const DISABLED_OVERLAY: React.CSSProperties = { opacity: 0.4, cursor: 'not-allowed' }

export interface QuickBookRailProps {
  onSelect: (courses: CourseCode[]) => void
  dragEnabled?: boolean
}

export const PILL_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-label)', /* design-ok: dense pill, uses label token */
  color: 'var(--color-text-primary)',
  background: 'var(--color-primary-glow)',
  border: '2px solid var(--color-glass-border-hover)',
}

export const ACCENT_PILL_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-label)', /* design-ok: dense pill, uses label token */
  color: 'var(--color-accent)',
  background: 'var(--color-glass-bg)',
  border: '1px solid var(--color-accent)',
}

const TOOLTIP_LABEL = 'Complete your profile to create bookings'

const PLUS_TEMPLATE = { id: 'plus', label: '+ Booking', courses: [] as CourseCode[] }

export function QuickBookRail({ onSelect, dragEnabled }: QuickBookRailProps) {
  const { isLoading } = useCurrentUser()
  const onboardingStatus = useQuery(api.users.getOnboardingStatus)
  const canBook = !isLoading && onboardingStatus?.percentage === 100

  return (
    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
      {COURSE_TEMPLATES.map((template) => {
        if (dragEnabled) {
          const pill = (
            <DraggablePill
              key={template.id}
              template={template}
              canBook={canBook}
              onSelect={onSelect}
              style={PILL_STYLE}
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

        const btn = ( /* design-ok */
          <button
            key={template.id}
            type="button"
            disabled={!canBook}
            className={`${PILL_BASE} ${canBook ? 'cursor-pointer transition-opacity hover:opacity-70' : ''}`}
            style={canBook ? PILL_STYLE : { ...PILL_STYLE, ...DISABLED_OVERLAY }}
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
        <span className="hidden sm:inline-flex ml-auto">
          {dragEnabled ? (
            <DraggablePill
              template={PLUS_TEMPLATE}
              canBook={canBook}
              onSelect={onSelect}
              style={ACCENT_PILL_STYLE}
            />
          ) : (
            <button
              type="button"
              className={`${PILL_BASE} cursor-pointer transition-opacity hover:opacity-70`}
              style={ACCENT_PILL_STYLE}
              onClick={() => onSelect([] as CourseCode[])}
            >
              + Booking
            </button>
          )}
        </span>
      ) : (
        <Tooltip label={TOOLTIP_LABEL} className="hidden sm:inline-flex ml-auto">
          <button
            type="button"
            disabled
            className={PILL_BASE}
            style={{ ...ACCENT_PILL_STYLE, ...DISABLED_OVERLAY }}
          >
            + Booking
          </button>
        </Tooltip>
      )}
    </div>
  )
}
