'use client'

import { FlagPill } from '@/components/profiles/language-picker'
import { resolveLanguages } from '@/lib/constants/dive-languages'
import type { DirectoryEntry } from '../../../convex/directory'

interface InstructorCardContentProps {
  entry: DirectoryEntry | undefined
  slug: string
  action: React.ReactNode
}

export function InstructorCardContent({ entry, slug, action }: InstructorCardContentProps) {
  const uniqueRatings = [...new Set(entry?.credentials?.flatMap((c) => c.specialtyRatings) ?? [])]
  const resolvedLangs = resolveLanguages(entry?.languages ?? [])

  return (
    <div className="flex-1 min-w-0 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body font-medium truncate text-primary">{entry?.name ?? slug}</p>
        {action}
      </div>

      {entry && ((entry.agencies?.length ?? 0) > 0 || resolvedLangs.length > 0) && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 items-center">
            {entry.agencies?.map((a) => (
              <span
                key={a}
                className="text-label px-1.5 py-0.5 rounded-[var(--border-radius-button)] shrink-0"
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

      {uniqueRatings.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          {uniqueRatings.map((rating) => (
            <span
              key={rating}
              className="text-label px-1.5 py-0.5 rounded-[var(--border-radius-button)] shrink-0"
              style={{
                background: 'var(--color-glass-bg)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {rating}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
