import type { CourseCode } from '@/lib/constants/course-catalog'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuickBookTemplate {
  id: string
  label: string
  courses: CourseCode[]
}

// ── Templates ─────────────────────────────────────────────────────────────────

export const COURSE_TEMPLATES: QuickBookTemplate[] = [
  { id: 'dsd', label: 'DSD', courses: ['DSD'] },
  { id: 'ow', label: 'OWC', courses: ['OW'] },
  { id: 'aow', label: 'AOWC', courses: ['AOW'] },
  { id: 'ow-aow', label: 'O+A', courses: ['OW', 'AOW'] },
  { id: 'fd', label: 'FD', courses: ['FD'] },
]
