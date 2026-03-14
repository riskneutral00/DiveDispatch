import { Users } from 'lucide-react'
import type { DirectoryEntry } from '../../../convex/directory'
import { StakeholderCard } from './stakeholder-card'

interface StakeholderGridProps {
  entries: DirectoryEntry[]
  isLoading?: boolean
}

export function StakeholderGrid({ entries, isLoading }: StakeholderGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="glass h-28 rounded-[var(--border-radius)] animate-pulse"
            style={{ background: 'var(--color-glass-bg)' }}
          />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 gap-3"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <Users size={40} strokeWidth={1.5} />
        <p className="text-sm font-medium">No results found</p>
        <p className="text-xs">Try a different role or search term.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {entries.map((entry) => (
        <StakeholderCard key={`${entry.role}-${entry.slug}`} entry={entry} />
      ))}
    </div>
  )
}
