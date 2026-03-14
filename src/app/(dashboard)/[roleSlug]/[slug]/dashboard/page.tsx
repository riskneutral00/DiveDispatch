import { Anchor } from 'lucide-react'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'
import { DashboardStats } from '@/components/dashboard/dashboard-stats'
import { BookingList } from '@/components/dashboard/booking-list'
import { OpenRequests } from '@/components/dashboard/open-requests'
import { ConfirmedSchedule } from '@/components/dashboard/confirmed-schedule'
import { AvailabilityCalendar } from '@/components/dashboard/availability-calendar'
import { ProfileCompletionBanner } from '@/components/dashboard/profile-completion-banner'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ roleSlug: string; slug: string }>
}) {
  const { roleSlug, slug } = await params
  const roleConfig = ROLE_BY_KEY[roleSlug as RoleKey]

  const RoleIcon = roleConfig?.icon ?? Anchor
  const isOrganizer = roleConfig?.isOrganizer ?? false
  const isResourceOnly = (roleConfig?.isResource ?? false) && !isOrganizer
  const clerkRole = roleConfig?.clerkRole

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ProfileCompletionBanner roleSlug={roleSlug as RoleKey} slug={slug} />
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <RoleIcon size={26} style={{ color: 'var(--color-primary)' }} />
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            {roleConfig?.label ?? roleSlug} Dashboard
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {slug}
        </p>
      </div>

      {/* Operator dashboard: stats + booking list */}
      {isOrganizer && clerkRole && (
        <>
          <DashboardStats ownerId={slug} ownerType={clerkRole} />
          <BookingList ownerId={slug} ownerType={clerkRole} />
        </>
      )}

      {/* Resource dashboard: requests + schedule + availability */}
      {isResourceOnly && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: open requests */}
          <div className="space-y-4">
            <div>
              <h2
                className="text-base font-semibold mb-3"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
              >
                Pending Requests
              </h2>
              <OpenRequests confirmOnDecline />
            </div>

            <div>
              <h2
                className="text-base font-semibold mb-3"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
              >
                Confirmed Schedule
              </h2>
              <ConfirmedSchedule />
            </div>
          </div>

          {/* Right column: availability calendar */}
          <div>
            <h2
              className="text-base font-semibold mb-3"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
            >
              Availability
            </h2>
            <AvailabilityCalendar />
          </div>
        </div>
      )}

      {/* Dual-role: show both operator and resource sections */}
      {isOrganizer && roleConfig?.isResource && clerkRole && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div>
            <h2
              className="text-base font-semibold mb-3"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
            >
              Incoming Requests
            </h2>
            <OpenRequests confirmOnDecline />
          </div>
          <div>
            <h2
              className="text-base font-semibold mb-3"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
            >
              Availability
            </h2>
            <AvailabilityCalendar />
          </div>
        </div>
      )}
    </div>
  )
}
