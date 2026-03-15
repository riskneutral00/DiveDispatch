import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { BoatProfileForm } from '@/components/dashboard/boat-profile-form'
import { PreferencesEditor } from '@/components/dashboard/preferences-editor'

export default async function BoatSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <DashboardShell roleSlug="boat" slug={slug}>
      <BoatProfileForm />
      <PreferencesEditor />
    </DashboardShell>
  )
}
