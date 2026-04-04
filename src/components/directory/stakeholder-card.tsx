'use client'

import React from 'react'
import { BadgeCheck, MapPin, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { RichDirectoryEntry } from '@/lib/types/directory'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { LanguageFlags } from '@/components/profiles/language-flags'


// null = no action button; undefined = show "View"
const ROLE_ACTION: Record<string, string | null> = {
  Instructor: null,
  DiveMaster: null,
  Boat: 'Assign',
  Equipment: 'View Inventory',
  Pool: 'Reserve Lane',
  Compressor: 'Book Fill',
}

const GAS_MIX_COLORS: Record<string, string> = {
  air: 'var(--color-info, var(--color-secondary))',
  nitrox: 'var(--color-success)',
  trimix: 'var(--color-warning)',
}

interface StakeholderCardProps {
  entry: RichDirectoryEntry
  isPreferred?: boolean
  onTogglePreferred?: (slug: string) => void
}

export const StakeholderCard = React.memo(function StakeholderCard({
  entry,
  isPreferred = false,
  onTogglePreferred,
}: StakeholderCardProps) {
  const initials = entry.name.slice(0, 2).toUpperCase()
  const location = [entry.placeName, entry.country].filter(Boolean).join(', ')
  const roleLabel = ROLE_BY_CLERK_ROLE[entry.role as ClerkRole]?.label ?? entry.role

  const actionLabel =
    entry.role in ROLE_ACTION ? ROLE_ACTION[entry.role] : 'View'

  // First agency for badge display
  const primaryAgency = entry.agencies?.[0]

  return (
    <Card hoverable className="h-full flex flex-col">
      {/* Non-navigating card body */}
      <div className="flex-1 min-w-0">
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
            {/* Name + verified + star */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="font-semibold text-sm truncate text-primary"
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
              {entry.role === 'Instructor' && onTogglePreferred && (
                <button
                  type="button"
                  onClick={() => onTogglePreferred(entry.slug)}
                  aria-label={isPreferred ? 'Remove from preferred' : 'Add to preferred'}
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    background: isPreferred
                      ? 'var(--color-primary-muted)'
                      : 'var(--color-glass-bg)',
                    color: isPreferred ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    transitionDuration: 'var(--transition-speed)',
                  }}
                >
                  <Star size={12} fill={isPreferred ? 'currentColor' : 'none'} />
                </button>
              )}
            </div>

            {/* Role badge + agency badge for instructors */}
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              <Badge size="sm" variant={entry.verified ? 'success' : 'default'}>
                {roleLabel}
              </Badge>
              {entry.role === 'Instructor' && primaryAgency && (
                <Badge size="sm" variant="info">
                  {primaryAgency}
                </Badge>
              )}
              {entry.role === 'Agent' && entry.association && (
                <Badge size="sm" variant="default">
                  {entry.association}
                </Badge>
              )}
            </div>

            {/* Location */}
            {location && (
              <div
                className="mt-2 flex items-center gap-1 text-xs text-secondary"
              >
                <MapPin size={11} className="flex-shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Role-specific extra content */}

        {/* Instructor / DiveMaster: language flags */}
        {(entry.role === 'Instructor' || entry.role === 'DiveMaster') &&
          (entry.languages?.length ?? 0) > 0 && (
            <LanguageFlags languages={entry.languages!} className="mt-2 text-base leading-none" />
          )}

        {/* Boat: capacity + type */}
        {entry.role === 'Boat' && (entry.boatCapacity != null || entry.boatType) && (
          <div
            className="mt-2 text-xs text-secondary"
          >
            {entry.boatCapacity != null && entry.boatCapacity > 0 && (
              <span>Cap. {entry.boatCapacity} divers</span>
            )}
            {entry.boatType && (
              <span>{entry.boatCapacity != null ? ' · ' : ''}{entry.boatType}</span>
            )}
          </div>
        )}

        {/* Pool: depth + capacity */}
        {entry.role === 'Pool' && (entry.maxDepth != null || entry.maxCapacity != null) && (
          <div
            className="mt-2 text-xs text-secondary"
          >
            {entry.maxDepth != null && entry.maxDepth > 0 && (
              <span>{entry.maxDepth}m max depth</span>
            )}
            {entry.maxCapacity != null && entry.maxCapacity > 0 && (
              <span>{entry.maxDepth != null ? ' · ' : ''}Cap. {entry.maxCapacity}</span>
            )}
          </div>
        )}

        {/* Compressor: gas mix badges */}
        {entry.role === 'Compressor' && entry.gasMixes && entry.gasMixes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {entry.gasMixes.map((mix) => (
              <span
                key={mix}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                style={{
                  background: `color-mix(in srgb, ${GAS_MIX_COLORS[mix] ?? 'var(--color-text-secondary)'} 20%, transparent)`,
                  color: GAS_MIX_COLORS[mix] ?? 'var(--color-text-secondary)',
                  borderColor: `color-mix(in srgb, ${GAS_MIX_COLORS[mix] ?? 'var(--color-text-secondary)'} 30%, transparent)`,
                }}
              >
                {mix.charAt(0).toUpperCase() + mix.slice(1)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action button (outside card body to avoid nested interactive elements) */}
      {actionLabel && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-glass-border)' }}>
          <button
            type="button"
            onClick={() => {
              // placeholder — action TBD
            }}
            className="w-full px-3 py-1.5 rounded-[var(--border-radius)] text-xs font-medium transition-colors text-primary"
            style={{ background: 'var(--color-glass-bg)',
              border: '1px solid var(--color-glass-border)',
              transitionDuration: 'var(--transition-speed)' }}
          >
            {actionLabel}
          </button>
        </div>
      )}
    </Card>
  )
})
