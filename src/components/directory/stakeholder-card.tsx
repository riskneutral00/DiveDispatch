import Link from 'next/link'
import { BadgeCheck, Languages, MapPin } from 'lucide-react'
import { GlassBadge } from '@/components/glass/glass-badge'
import { GlassCard } from '@/components/glass/glass-card'
import type { DirectoryEntry } from '../../../convex/directory'

const ROLE_LABELS: Record<string, string> = {
  DiveCenter: 'Dive Center',
  Agent: 'Agent',
  Instructor: 'Instructor',
  Boat: 'Boat',
  Equipment: 'Equipment',
  Pool: 'Pool',
  Compressor: 'Compressor',
  DiveMaster: 'Dive Master',
  Liveaboard: 'Liveaboard',
  DiveResort: 'Dive Resort',
  DiveHostel: 'Dive Hostel',
  DiveSite: 'Dive Site',
}

const ROLE_PATH_PREFIX: Record<string, string> = {
  DiveCenter: 'dive-center',
  Agent: 'agent',
  Instructor: 'instructor',
  Boat: 'boat',
  Equipment: 'equipment',
  Pool: 'pool',
  Compressor: 'compressor',
  DiveMaster: 'dive-master',
  Liveaboard: 'liveaboard',
  DiveResort: 'dive-resort',
  DiveHostel: 'dive-hostel',
  DiveSite: 'dive-site',
}

function profileHref(entry: DirectoryEntry): string {
  const prefix = ROLE_PATH_PREFIX[entry.role]
  if (!prefix) return '#'
  return `/${prefix}/${entry.slug}/settings`
}

interface StakeholderCardProps {
  entry: DirectoryEntry
}

export function StakeholderCard({ entry }: StakeholderCardProps) {
  const initials = entry.name.slice(0, 2).toUpperCase()
  const location = [entry.city, entry.country].filter(Boolean).join(', ')
  const roleLabel = ROLE_LABELS[entry.role] ?? entry.role

  return (
    <Link href={profileHref(entry)} className="block h-full">
      <GlassCard hoverable className="h-full">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
            }}
          >
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            {/* Name + verified */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="font-semibold text-sm truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {entry.name}
              </span>
              {entry.verified && (
                <BadgeCheck
                  size={14}
                  aria-label="Verified"
                  style={{ color: 'var(--color-success)', flexShrink: 0 }}
                />
              )}
            </div>

            {/* Role badge */}
            <div className="mt-1">
              <GlassBadge size="sm" variant={entry.verified ? 'success' : 'default'}>
                {roleLabel}
              </GlassBadge>
            </div>

            {/* Location */}
            {location && (
              <div
                className="mt-2 flex items-center gap-1 text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <MapPin size={11} className="flex-shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            )}

            {/* Languages */}
            {entry.languages.length > 0 && (
              <div
                className="mt-1 flex items-center gap-1 text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <Languages size={11} className="flex-shrink-0" />
                <span className="truncate">{entry.languages.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </Link>
  )
}
