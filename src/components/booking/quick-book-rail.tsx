'use client'

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

const PILL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-text-primary)',
  background: 'rgba(232,120,106,0.06)',
  border: '2px solid rgba(232,120,106,0.20)',
}

const ACCENT_PILL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-accent)',
  background: 'rgba(240,184,102,0.08)',
  border: '1px solid var(--color-accent)',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QuickBookRail({ onSelect }: QuickBookRailProps) {
  return (
    <div className="flex items-center gap-1.5">
      {COURSE_TEMPLATES.map((template) => (
        <button
          key={template.id}
          type="button"
          className="rounded-full px-3 py-1 font-medium select-none transition-all cursor-pointer hover:brightness-125 hover:scale-105 focus:outline-none focus-visible:ring-2"
          style={PILL_STYLE}
          onClick={() => onSelect(template.courses)}
        >
          {template.label}
        </button>
      ))}

      <button
        type="button"
        className="ml-auto rounded-full px-3 py-1 font-medium select-none transition-all cursor-pointer hover:brightness-125 hover:scale-105 focus:outline-none focus-visible:ring-2"
        style={ACCENT_PILL_STYLE}
        onClick={() => onSelect([])}
      >
        + Booking
      </button>
    </div>
  )
}
