import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default async function InstructorLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <DashboardShell roleSlug="instructor" slug={slug}>
      {children}
    </DashboardShell>
  )
}
