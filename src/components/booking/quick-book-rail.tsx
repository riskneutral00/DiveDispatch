'use client'

import { useQuery } from 'convex/react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
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

export interface QuickBookRailProps {
  onSelect: (courses: CourseCode[]) => void
  /** Currently armed pill ID for mobile tap-to-date flow */
  armedPillId?: string | null
  /** Called when a pill is tapped (mobile) to arm/disarm it */
  onArmPill?: (pillId: string | null) => void
}

/** Data attached to a draggable pill — read on drop by the calendar */
export interface PillDragData {
  type: 'quick-book-pill'
  courses: CourseCode[]
  label: string
}

// ── Templates ─────────────────────────────────────────────────────────────────

export const COURSE_TEMPLATES: QuickBookTemplate[] = [
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

const ARMED_RING: React.CSSProperties = {
  boxShadow: '0 0 0 2px var(--color-primary), 0 0 12px var(--color-primary-glow)',
}

const DISABLED_OVERLAY: React.CSSProperties = { opacity: 0.4, cursor: 'not-allowed' }

const TOOLTIP_LABEL = 'Complete your profile to create bookings'

// ── Draggable Pill ───────────────────────────────────────────────────────────

function DraggablePill({
  template,
  canBook,
  isArmed,
  onSelect,
  onArmPill,
  style,
}: {
  template: QuickBookTemplate
  canBook: boolean
  isArmed: boolean
  onSelect: (courses: CourseCode[]) => void
  onArmPill?: (pillId: string | null) => void
  style: React.CSSProperties
}) {
  const dragData: PillDragData = { type: 'quick-book-pill', courses: template.courses, label: template.label }

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pill-${template.id}`,
    data: dragData,
    disabled: !canBook,
  })

  const dragStyle: React.CSSProperties = {
    ...style,
    ...(isArmed ? ARMED_RING : {}),
    ...(isDragging ? { opacity: 0.6, zIndex: 50 } : {}),
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
  }

  function handleClick() {
    if (!canBook) return
    // Mobile tap: arm/disarm pill for tap-to-date flow
    if (onArmPill) {
      if (isArmed) {
        onArmPill(null)
      } else {
        onArmPill(template.id)
      }
    } else {
      onSelect(template.courses)
    }
  }

  const btn = (
    <button
      ref={setNodeRef}
      type="button"
      disabled={!canBook}
      className={`${PILL_BASE} ${canBook ? 'cursor-grab hover:brightness-125 hover:scale-105' : ''} ${isDragging ? 'cursor-grabbing' : ''}`}
      style={canBook ? dragStyle : { ...style, ...DISABLED_OVERLAY }}
      onClick={handleClick}
      {...(canBook ? { ...listeners, ...attributes } : {})}
    >
      {template.label}
    </button>
  )

  if (!canBook) {
    return (
      <GlassTooltip key={template.id} label={TOOLTIP_LABEL}>
        {btn}
      </GlassTooltip>
    )
  }

  return <span key={template.id}>{btn}</span>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QuickBookRail({ onSelect, armedPillId, onArmPill }: QuickBookRailProps) {
  const { isLoading } = useCurrentUser()
  const onboardingStatus = useQuery(api.users.getOnboardingStatus)
  const canBook = !isLoading && onboardingStatus?.percentage === 100

  // + Booking pill (also draggable)
  const plusData: PillDragData = { type: 'quick-book-pill', courses: [] as CourseCode[], label: '+ Booking' }
  const { attributes: plusAttrs, listeners: plusListeners, setNodeRef: plusRef, transform: plusTransform, isDragging: plusDragging } = useDraggable({
    id: 'pill-plus',
    data: plusData,
    disabled: !canBook,
  })

  const plusDragStyle: React.CSSProperties = {
    ...ACCENT_PILL_STYLE,
    ...(armedPillId === 'plus' ? ARMED_RING : {}),
    ...(plusDragging ? { opacity: 0.6, zIndex: 50 } : {}),
    ...(plusTransform ? { transform: CSS.Translate.toString(plusTransform) } : {}),
  }

  function handlePlusClick() {
    if (!canBook) return
    if (onArmPill) {
      onArmPill(armedPillId === 'plus' ? null : 'plus')
    } else {
      onSelect([] as CourseCode[])
    }
  }

  const plusBtn = (
    <button
      ref={plusRef}
      type="button"
      disabled={!canBook}
      className={`${PILL_BASE} ${canBook ? 'cursor-grab hover:brightness-125 hover:scale-105' : ''} ${plusDragging ? 'cursor-grabbing' : ''}`}
      style={canBook ? plusDragStyle : { ...ACCENT_PILL_STYLE, ...DISABLED_OVERLAY }}
      onClick={handlePlusClick}
      {...(canBook ? { ...plusListeners, ...plusAttrs } : {})}
    >
      + Booking
    </button>
  )

  return (
    <div className="flex items-center gap-1.5">
      {COURSE_TEMPLATES.map((template) => (
        <DraggablePill
          key={template.id}
          template={template}
          canBook={canBook}
          isArmed={armedPillId === template.id}
          onSelect={onSelect}
          onArmPill={onArmPill}
          style={PILL_STYLE}
        />
      ))}

      {canBook ? (
        <span className="ml-auto">{plusBtn}</span>
      ) : (
        <GlassTooltip label={TOOLTIP_LABEL} className="ml-auto">{plusBtn}</GlassTooltip>
      )}
    </div>
  )
}
