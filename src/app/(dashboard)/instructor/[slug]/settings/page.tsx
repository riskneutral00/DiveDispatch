import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { InstructorProfileForm } from '@/components/dashboard/instructor-profile-form'

export default async function InstructorSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <DashboardShell roleSlug="instructor" slug={slug}>
      <InstructorProfileForm />
    </DashboardShell>
  )
}
