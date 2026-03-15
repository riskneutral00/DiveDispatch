import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { CompressorProfileForm } from '@/components/dashboard/compressor-profile-form'
import { PreferencesEditor } from '@/components/dashboard/preferences-editor'

export default async function CompressorSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <DashboardShell roleSlug="compressor" slug={slug}>
      <CompressorProfileForm />
      <PreferencesEditor />
    </DashboardShell>
  )
}
