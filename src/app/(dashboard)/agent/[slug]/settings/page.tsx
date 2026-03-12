import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { AgentProfileForm } from '@/components/dashboard/agent-profile-form'

export default async function AgentSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <DashboardShell roleSlug="agent" slug={slug}>
      <AgentProfileForm />
    </DashboardShell>
  )
}
