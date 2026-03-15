import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { DiveCenterProfileForm } from '@/components/dashboard/dive-center-profile-form'
import { PreferencesEditor } from '@/components/dashboard/preferences-editor'

export default async function DiveCenterSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <DashboardShell roleSlug="dive-center" slug={slug}>
      <DiveCenterProfileForm />
      <PreferencesEditor />
    </DashboardShell>
  )
}
