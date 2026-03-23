'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'
import { GlassButton } from '@/components/glass/glass-button'
import { Spinner } from '@/components/common/spinner'

interface Props {
  slugs: string[]
  onChange: (slugs: string[]) => void
}

export function PreferredBoatList({ slugs, onChange }: Props) {
  const [search, setSearch] = useState('')

  const allBoats = useQuery(api.directory.listByRole, { role: 'Boat' })

  if (allBoats === undefined) {
    return (
      <div className="flex items-center justify-center py-6" style={{ color: 'var(--color-primary)' }}>
        <Spinner />
      </div>
    )
  }

  const slugToEntry = Object.fromEntries(
    (allBoats ?? []).map((e) => [e.slug, e]),
  )

  const trimmed = search.trim().toLowerCase()
  const searchResults = trimmed
    ? (allBoats ?? []).filter(
        (e) =>
          !slugs.includes(e.slug) &&
          (e.name.toLowerCase().includes(trimmed) ||
            e.placeName.toLowerCase().includes(trimmed)),
      )
    : []

  const moveUp = (index: number) => {
    if (index === 0) return
    const next = [...slugs]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next)
  }

  const moveDown = (index: number) => {
    if (index === slugs.length - 1) return
    const next = [...slugs]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onChange(next)
  }

  const remove = (index: number) => {
    onChange(slugs.filter((_, i) => i !== index))
  }

  const add = (slug: string) => {
    if (!slugs.includes(slug)) {
      onChange([...slugs, slug])
    }
    setSearch('')
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <GlassInput
          label="Add boat"
          placeholder="Search by name or city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {searchResults.length > 0 && (
          <div
            className="absolute z-10 left-0 right-0 mt-1 rounded-[var(--border-radius)] border overflow-hidden"
            style={{
              background: 'var(--color-glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              borderColor: 'var(--color-glass-border)',
            }}
          >
            {searchResults.slice(0, 6).map((entry) => (
              <button
                key={entry.slug}
                type="button"
                onClick={() => add(entry.slug)}
                className="w-full text-left px-3 py-2 text-sm transition-colors hover:opacity-80"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <span className="font-medium">{entry.name}</span>
                <span className="ml-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {entry.placeName}
                </span>
                {entry.boatType && (
                  <span
                    className="ml-2 text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--color-glass-bg-elevated)', color: 'var(--color-text-secondary)' }}
                  >
                    {entry.boatType}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {slugs.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          No preferred boats added yet.
        </p>
      ) : (
        <div className="space-y-2">
          {slugs.map((slug, index) => {
            const entry = slugToEntry[slug]
            return (
              <GlassCard key={slug} padding="sm">
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-bold w-5 text-center shrink-0"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {entry?.name ?? slug}
                      </p>
                      {entry?.boatType && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: 'var(--color-glass-bg-elevated)', color: 'var(--color-text-secondary)' }}
                        >
                          {entry.boatType}
                        </span>
                      )}
                    </div>
                    {entry?.placeName && (
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                        {entry.placeName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <GlassButton variant="ghost" size="sm" type="button" onClick={() => moveUp(index)} disabled={index === 0} aria-label="Move up">
                      <ChevronUp size={16} />
                    </GlassButton>
                    <GlassButton variant="ghost" size="sm" type="button" onClick={() => moveDown(index)} disabled={index === slugs.length - 1} aria-label="Move down">
                      <ChevronDown size={16} />
                    </GlassButton>
                    <GlassButton variant="destructive-ghost" size="sm" type="button" onClick={() => remove(index)} aria-label="Remove boat">
                      <Trash2 size={16} />
                    </GlassButton>
                  </div>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
