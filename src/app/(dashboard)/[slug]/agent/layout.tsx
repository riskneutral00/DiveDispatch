import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default async function AgentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <DashboardShell roleSlug="agent" slug={slug}>
      {children}
    </DashboardShell>
  )
}
