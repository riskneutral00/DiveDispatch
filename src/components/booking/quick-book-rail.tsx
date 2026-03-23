'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { GlassTooltip } from '@/components/glass/glass-tooltip'
import type { CourseCode } from '@/lib/constants/course-catalog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuickBookTemplate {
  id: string
  label: string
  courses: CourseCode[]
}

interface QuickBookRailProps {
  onSelect: (courses: CourseCode[]) => void
}

// ── Templates ─────────────────────────────────────────────────────────────────

const COURSE_TEMPLATES: QuickBookTemplate[] = [
  { id: 'dsd', label: 'DSD', courses: ['DSD'] },
  { id: 'ow', label: 'OWC', courses: ['OW'] },
  { id: 'aow', label: 'AOWC', courses: ['AOW'] },
  { id: 'ow-aow', label: 'O+A', courses: ['OW', 'AOW'] },
  { id: 'fd', label: 'FD', courses: ['FD'] },
]

const PILL_BASE = 'rounded-full px-3 py-1 font-medium select-none transition-all focus:outline-none focus-visible:ring-2'

const PILL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-text-primary)',
  background: 'var(--color-primary-glow)',
  border: '2px solid var(--color-glass-border-hover)',
}

const ACCENT_PILL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-accent)',
  background: 'var(--color-glass-bg)',
  border: '1px solid var(--color-accent)',
}

const DISABLED_OVERLAY: React.CSSProperties = { opacity: 0.4, cursor: 'not-allowed' }

const TOOLTIP_LABEL = 'Complete your profile to create bookings'

// ── Component ─────────────────────────────────────────────────────────────────

export function QuickBookRail({ onSelect }: QuickBookRailProps) {
  const { user, isLoading } = useCurrentUser()
  const onboardingStatus = useQuery(api.users.getOnboardingStatus)
  const canBook = !isLoading && onboardingStatus?.percentage === 100

  return (
    <div className="flex items-center gap-1.5">
      {COURSE_TEMPLATES.map((template) => {
        const btn = (
          <button
            type="button"
            disabled={!canBook}
            className={`${PILL_BASE} ${canBook ? 'cursor-pointer hover:brightness-125 hover:scale-105' : ''}`}
            style={canBook ? PILL_STYLE : { ...PILL_STYLE, ...DISABLED_OVERLAY }}
            onClick={canBook ? () => onSelect(template.courses) : undefined}
          >
            {template.label}
          </button>
        )
        return canBook ? (
          <span key={template.id}>{btn}</span>
        ) : (
          <GlassTooltip key={template.id} label={TOOLTIP_LABEL}>
            {btn}
          </GlassTooltip>
        )
      })}

      {(() => {
        const btn = (
          <button
            type="button"
            disabled={!canBook}
            className={`${PILL_BASE} ${canBook ? 'cursor-pointer hover:brightness-125 hover:scale-105' : ''}`}
            style={canBook ? ACCENT_PILL_STYLE : { ...ACCENT_PILL_STYLE, ...DISABLED_OVERLAY }}
            onClick={canBook ? () => onSelect([]) : undefined}
          >
            + Booking
          </button>
        )
        return canBook ? (
          <span className="ml-auto">{btn}</span>
        ) : (
          <GlassTooltip label={TOOLTIP_LABEL} className="ml-auto">{btn}</GlassTooltip>
        )
      })()}
    </div>
  )
}
