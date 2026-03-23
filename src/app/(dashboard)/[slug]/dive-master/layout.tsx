import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default async function DiveMasterLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <DashboardShell roleSlug="dive-master" slug={slug}>
      {children}
    </DashboardShell>
  )
}
