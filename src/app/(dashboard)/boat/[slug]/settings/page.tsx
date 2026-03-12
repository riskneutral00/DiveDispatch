import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { BoatProfileForm } from '@/components/dashboard/boat-profile-form'

export default async function BoatSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <DashboardShell roleSlug="boat" slug={slug}>
      <BoatProfileForm />
    </DashboardShell>
  )
}
