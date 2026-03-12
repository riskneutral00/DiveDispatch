'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass'

interface ReferralTrackerProps {
  agentId: string
}

export function ReferralTracker({ agentId }: ReferralTrackerProps) {
  const bookings = useQuery(api.bookings.listByOwner, {
    ownerId: agentId,
    ownerType: 'Agent',
  })

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const total = bookings?.length ?? 0
  const upcoming = bookings?.filter((b) => b.status === 'Upcoming').length ?? 0
  const thisMonthCount =
    bookings?.filter((b) => b.startDate.startsWith(thisMonth)).length ?? 0

  const stats = [
    { label: 'Total Bookings', value: total },
    { label: 'Upcoming', value: upcoming },
    { label: 'This Month', value: thisMonthCount },
    // Referral-specific count requires by_agentId query (pending backend addition)
    { label: 'Referrals', value: null as number | null },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              color:
                bookings == null || value == null
                  ? 'var(--color-text-secondary)'
                  : 'var(--color-text-primary)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {bookings == null ? '—' : value == null ? '—' : value}
          </p>
        </GlassCard>
      ))}
    </div>
  )
}
