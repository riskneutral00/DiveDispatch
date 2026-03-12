import { Droplets } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { OpenRequests } from '@/components/dashboard/open-requests'
import { ConfirmedSchedule } from '@/components/dashboard/confirmed-schedule'
import { AvailabilityCalendar } from '@/components/dashboard/availability-calendar'

export default async function DiveMasterDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <DashboardShell roleSlug="dive-master" slug={slug}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Droplets size={26} style={{ color: 'var(--color-primary)' }} />
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
            >
              Dive Master Dashboard
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {slug}
          </p>
        </div>

        {/* Resource sections: requests left, availability right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: open requests + confirmed schedule */}
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
      </div>
    </DashboardShell>
  )
}
