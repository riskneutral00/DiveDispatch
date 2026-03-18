'use client'

import { Anchor, BookOpen, Star, Waves } from 'lucide-react'
import { GlassCard } from '@/components/glass'
import type { CourseCode } from '@/lib/constants/course-catalog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuickBookTemplate {
  id: string
  label: string
  description: string
  courses: CourseCode[]
  icon: React.ReactNode
  colorVar: string
}

interface QuickBookRailProps {
  onSelect: (courses: CourseCode[]) => void
}

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES: QuickBookTemplate[] = [
  {
    id: 'dsd',
    label: 'DSD',
    description: 'Discover Scuba Diving — first-time experience',
    courses: ['DSD'],
    icon: <Waves size={18} />,
    colorVar: 'var(--color-accent)',
  },
  {
    id: 'ow',
    label: 'Open Water',
    description: 'Full OW certification course',
    courses: ['OW'],
    icon: <BookOpen size={18} />,
    colorVar: 'var(--color-primary)',
  },
  {
    id: 'aow',
    label: 'Advanced OW',
    description: 'Advanced Open Water course',
    courses: ['AOW'],
    icon: <Star size={18} />,
    colorVar: 'var(--color-secondary)',
  },
  {
    id: 'ow-aow',
    label: 'OW + AOW',
    description: 'Open Water then Advanced back-to-back',
    courses: ['OW', 'AOW'],
    icon: <Anchor size={18} />,
    colorVar: 'var(--color-warning, #f59e0b)',
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function QuickBookRail({ onSelect }: QuickBookRailProps) {
  return (
    <div className="flex flex-col gap-2">
      <p
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-heading)' }}
      >
        Quick Book
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template.courses)}
            className="text-left focus:outline-none focus-visible:ring-2 rounded-[var(--border-radius)]"
            style={{ outlineColor: 'var(--color-accent)' }}
          >
            <GlassCard padding="sm" elevated className="h-full hover:scale-[1.02] transition-transform duration-150">
              <div className="flex flex-col gap-2">
                <span style={{ color: template.colorVar }}>{template.icon}</span>
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
                  >
                    {template.label}
                  </p>
                  <p
                    className="text-xs mt-0.5 leading-snug"
                    style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                  >
                    {template.description}
                  </p>
                </div>
              </div>
            </GlassCard>
          </button>
        ))}
      </div>
    </div>
  )
}
