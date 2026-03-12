import { Anchor } from 'lucide-react'
import { GlassCard } from '@/components/glass'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ roleSlug: string; slug: string }>
}) {
  const { roleSlug, slug } = await params
  const roleConfig = ROLE_BY_KEY[roleSlug as RoleKey]

  const RoleIcon = roleConfig?.icon ?? Anchor

  return (
    <div className="max-w-4xl mx-auto">
      {/* Welcome header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <RoleIcon size={28} style={{ color: 'var(--color-primary)' }} />
          <h1
            className="text-2xl font-bold"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'var(--color-text-primary)',
            }}
          >
            {roleConfig?.label ?? roleSlug} Dashboard
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {slug}
        </p>
      </div>

      {/* Placeholder cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <GlassCard elevated>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {roleConfig?.isOrganizer ? 'Active Bookings' : 'Pending Reservations'}
          </p>
          <p
            className="text-3xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            —
          </p>
        </GlassCard>

        <GlassCard elevated>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {roleConfig?.isOrganizer ? 'Upcoming Sessions' : 'Confirmed This Week'}
          </p>
          <p
            className="text-3xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            —
          </p>
        </GlassCard>

        <GlassCard elevated>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {roleConfig?.isOrganizer ? 'Resources Confirmed' : 'Availability'}
          </p>
          <p
            className="text-3xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            —
          </p>
        </GlassCard>
      </div>

      {/* Coming soon notice */}
      <div className="mt-8">
        <GlassCard padding="md">
          <p
            className="text-sm text-center"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Dashboard widgets are coming soon. Navigation and shell are ready.
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
