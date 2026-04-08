'use client'

import { FlagPill } from '@/components/profiles/language-picker'
import { resolveLanguages } from '@/lib/constants/dive-languages'
import { Tooltip } from '@/components/ui/tooltip'
import type { DirectoryEntry } from '../../../convex/directory'

interface InstructorCardContentProps {
  entry: DirectoryEntry | undefined
  slug: string
  action: React.ReactNode
  layout?: 'row' | 'card'
}

export function InstructorCardContent({ entry, slug, action, layout = 'row' }: InstructorCardContentProps) {
  const uniqueRatings = [...new Set(entry?.credentials?.flatMap((c) => c.specialtyRatings) ?? [])]
  const resolvedLangs = resolveLanguages(entry?.languages ?? [])

  if (layout === 'card') {
    return (
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-1">
          <p className="text-body font-medium truncate text-primary">{entry?.name ?? slug}</p>
          {action}
        </div>

        {entry && (entry.agencies?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
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
        )}

        {resolvedLangs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {resolvedLangs.map((lang) => (
              <FlagPill key={lang.code} lang={lang} active={false} onToggle={() => {}} disabled />
            ))}
          </div>
        )}

        {uniqueRatings.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {uniqueRatings.slice(0, 3).map((rating) => (
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
            {uniqueRatings.length > 3 && (
              <Tooltip label={uniqueRatings.slice(3).join(', ')}>
                <span className="text-label text-secondary">+{uniqueRatings.length - 3}</span>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    )
  }

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
          {uniqueRatings.slice(0, 3).map((rating) => (
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
          {uniqueRatings.length > 3 && (
            <Tooltip label={uniqueRatings.slice(3).join(', ')}>
              <span className="text-label text-secondary">+{uniqueRatings.length - 3}</span>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  )
}
