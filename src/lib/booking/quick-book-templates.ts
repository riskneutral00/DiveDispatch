import type { CourseCode } from '@/lib/constants/course-catalog'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuickBookTemplate {
  id: string
  label: string
  courses: CourseCode[]
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
