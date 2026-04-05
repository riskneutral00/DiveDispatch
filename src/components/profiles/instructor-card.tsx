'use client'

import { FlagPill } from '@/components/profiles/language-picker'
import { resolveLanguages } from '@/lib/constants/dive-languages'
import type { DirectoryEntry } from '../../../convex/directory'

interface InstructorCardContentProps {
  entry: DirectoryEntry | undefined
  slug: string
  action: React.ReactNode
}

/**
 * Shared instructor card display rows (name + action, agencies + flags, courses).
 * No outer wrapper, no divider — callers handle their own padding and separators.
 * Used by SortableInstructorRow (drag+trash) and InstructorCandidateRow (plus).
 */
export function InstructorCardContent({ entry, slug, action }: InstructorCardContentProps) {
  const uniqueCourses = [...new Set(entry?.credentials?.flatMap((c) => c.courses) ?? [])]
  const resolvedLangs = resolveLanguages(entry?.languages ?? [])

  return (
    <div className="flex-1 min-w-0 space-y-1">
      {/* Line 1: Name + action button */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium truncate text-primary">{entry?.name ?? slug}</p>
        {action}
      </div>

      {/* Line 2: Agency badges (left) + language flags (right) */}
      {entry && ((entry.agencies?.length ?? 0) > 0 || resolvedLangs.length > 0) && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 items-center">
            {entry.agencies?.map((a) => (
              <span
                key={a}
                className="text-xs px-1.5 py-0.5 rounded shrink-0"
                style={{
                  background: 'var(--color-glass-bg-elevated)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {a}
              </span>
            ))}
          </div>
          {resolvedLangs.length > 0 && (
            <div className="flex flex-wrap gap-1 items-center shrink-0">
              {resolvedLangs.map((lang) => (
                <FlagPill key={lang.code} lang={lang} active={false} onToggle={() => {}} disabled />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Line 3: Course/specialty badges */}
      {uniqueCourses.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          {uniqueCourses.map((course) => (
            <span
              key={course}
              className="text-xs px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: 'var(--color-glass-bg)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {course}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
