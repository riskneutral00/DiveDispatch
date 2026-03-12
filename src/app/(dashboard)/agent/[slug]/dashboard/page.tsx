import { Briefcase } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { ReferralTracker } from '@/components/dashboard/referral-tracker'
import { AgentBookingList } from '@/components/dashboard/agent-booking-list'

export default async function AgentDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <DashboardShell roleSlug="agent" slug={slug}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Briefcase size={26} style={{ color: 'var(--color-primary)' }} />
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
            >
              Agent Dashboard
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {slug}
          </p>
        </div>

        {/* Stats */}
        <ReferralTracker agentId={slug} />

        {/* Booking list with mode filter */}
        <AgentBookingList agentId={slug} />
      </div>
    </DashboardShell>
  )
}
