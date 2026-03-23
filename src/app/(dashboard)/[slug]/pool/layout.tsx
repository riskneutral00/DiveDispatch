import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default async function PoolLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <DashboardShell roleSlug="pool" slug={slug}>
      {children}
    </DashboardShell>
  )
}
