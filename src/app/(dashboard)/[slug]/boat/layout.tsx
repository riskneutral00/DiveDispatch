import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default async function BoatLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <DashboardShell roleSlug="boat" slug={slug}>
      {children}
    </DashboardShell>
  )
}
