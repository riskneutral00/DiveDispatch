'use client'

import Link from 'next/link'
import { BadgeCheck, MapPin, Star } from 'lucide-react'
import { GlassBadge } from '@/components/glass/glass-badge'
import { GlassCard } from '@/components/glass/glass-card'
import type { DirectoryEntry } from '../../../convex/directory'

// Extends DirectoryEntry with role-specific fields returned by the enhanced
// listByRole query (builder-directory-backend). Field names match the backend's
// DirectoryEntry exactly so merging this branch drops the extension cleanly.
export type RichDirectoryEntry = DirectoryEntry & {
  agencies?: string[]    // Instructor: credential agencies (e.g. ['PADI', 'SSI'])
  boatCapacity?: number  // Boat: max pax of largest vessel in fleet
  boatType?: string      // Boat: type of largest vessel
  gasMixes?: string[]    // Compressor: supported gas mixes
  maxDepth?: number      // Pool: max depth in metres
  maxCapacity?: number   // Pool: max capacity in pax
  association?: string   // Agent: primary association agency name
  isPreferred?: boolean  // Instructor: starred by the authenticated caller
}

// ISO alpha-2 → Regional Indicator Symbol emoji
// Each letter maps to codepoint 0x1F1A5 + charCode
function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return ''
  const OFFSET = 0x1f1a5
  return (
    String.fromCodePoint(OFFSET + code.toUpperCase().charCodeAt(0)) +
    String.fromCodePoint(OFFSET + code.toUpperCase().charCodeAt(1))
  )
}

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

function profileHref(entry: RichDirectoryEntry): string {
  const prefix = ROLE_PATH_PREFIX[entry.role]
  if (!prefix) return '#'
  return `/${prefix}/${entry.slug}/settings`
}

interface StakeholderCardProps {
  entry: RichDirectoryEntry
  isPreferred?: boolean
  onTogglePreferred?: (slug: string) => void
}

export function StakeholderCard({
  entry,
  isPreferred = false,
  onTogglePreferred,
}: StakeholderCardProps) {
  const initials = entry.name.slice(0, 2).toUpperCase()
  const location = [entry.city, entry.country].filter(Boolean).join(', ')
  const roleLabel = ROLE_LABELS[entry.role] ?? entry.role
  const href = profileHref(entry)

  const actionLabel =
    entry.role in ROLE_ACTION ? ROLE_ACTION[entry.role] : 'View'

  // First agency for badge display
  const primaryAgency = entry.agencies?.[0]

  return (
    <GlassCard hoverable className="h-full flex flex-col">
      {/* Clickable body */}
      <Link href={href} className="flex-1 block min-w-0">
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
              {entry.role === 'Instructor' && onTogglePreferred && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onTogglePreferred(entry.slug)
                  }}
                  aria-label={isPreferred ? 'Remove from preferred' : 'Add to preferred'}
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    background: isPreferred
                      ? 'rgba(59,130,246,0.15)'
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
              <GlassBadge size="sm" variant={entry.verified ? 'success' : 'default'}>
                {roleLabel}
              </GlassBadge>
              {entry.role === 'Instructor' && primaryAgency && (
                <GlassBadge size="sm" variant="info">
                  {primaryAgency}
                </GlassBadge>
              )}
              {entry.role === 'Agent' && entry.association && (
                <GlassBadge size="sm" variant="default">
                  {entry.association}
                </GlassBadge>
              )}
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
          </div>
        </div>

        {/* Role-specific extra content */}

        {/* Instructor / DiveMaster: language flags */}
        {(entry.role === 'Instructor' || entry.role === 'DiveMaster') &&
          entry.languages.length > 0 && (
            <div className="mt-2 flex items-center gap-0.5 flex-wrap">
              {entry.languages.slice(0, 6).map((code) => (
                <span
                  key={code}
                  className="text-base leading-none"
                  title={code}
                  aria-label={code}
                >
                  {flagEmoji(code)}
                </span>
              ))}
            </div>
          )}

        {/* Boat: capacity + type */}
        {entry.role === 'Boat' && (entry.boatCapacity != null || entry.boatType) && (
          <div
            className="mt-2 text-xs"
            style={{ color: 'var(--color-text-secondary)' }}
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
            className="mt-2 text-xs"
            style={{ color: 'var(--color-text-secondary)' }}
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
      </Link>

      {/* Action button (outside Link to avoid nested interactive elements) */}
      {actionLabel && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-glass-border)' }}>
          <button
            type="button"
            onClick={() => {
              // placeholder — navigation handled by card Link
            }}
            className="w-full px-3 py-1.5 rounded-[var(--border-radius)] text-xs font-medium transition-colors"
            style={{
              background: 'var(--color-glass-bg)',
              border: '1px solid var(--color-glass-border)',
              color: 'var(--color-text-primary)',
              transitionDuration: 'var(--transition-speed)',
            }}
          >
            {actionLabel}
          </button>
        </div>
      )}
    </GlassCard>
  )
}
