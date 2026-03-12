import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { DiveMasterProfileForm } from '@/components/dashboard/divemaster-profile-form'

export default async function DiveMasterSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <DashboardShell roleSlug="dive-master" slug={slug}>
      <DiveMasterProfileForm />
    </DashboardShell>
  )
}
