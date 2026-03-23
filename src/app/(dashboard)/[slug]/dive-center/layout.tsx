import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default async function DiveCenterLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <DashboardShell roleSlug="dive-center" slug={slug}>
      {children}
    </DashboardShell>
  )
}
