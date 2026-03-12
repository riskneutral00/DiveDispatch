'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass'
import type { ClerkRole } from '@/lib/constants/roles'

interface DashboardStatsProps {
  ownerId: string
  ownerType: ClerkRole
}

type OperatorType =
  | 'DiveCenter'
  | 'Agent'
  | 'Liveaboard'
  | 'DiveResort'
  | 'DiveHostel'
  | 'DiveSite'

const OPERATOR_TYPES = new Set<string>([
  'DiveCenter',
  'Agent',
  'Liveaboard',
  'DiveResort',
  'DiveHostel',
  'DiveSite',
])

export function DashboardStats({ ownerId, ownerType }: DashboardStatsProps) {
  const isOperator = OPERATOR_TYPES.has(ownerType)

  const bookings = useQuery(
    api.bookings.listByOwner,
    isOperator
      ? { ownerId, ownerType: ownerType as OperatorType }
      : 'skip',
  )

  if (!isOperator) return null

  const total = bookings?.length ?? 0
  const upcoming = bookings?.filter((b) => b.status === 'Upcoming').length ?? 0
  const draft = bookings?.filter((b) => b.status === 'Draft').length ?? 0

  const stats = [
    { label: 'Total Bookings', value: total },
    { label: 'Upcoming', value: upcoming },
    { label: 'Drafts', value: draft },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map(({ label, value }) => (
        <GlassCard key={label} elevated padding="sm">
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {label}
          </p>
          <p
            className="text-2xl font-bold"
            style={{
              color: bookings == null ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {bookings == null ? '—' : value}
          </p>
        </GlassCard>
      ))}
    </div>
  )
}
