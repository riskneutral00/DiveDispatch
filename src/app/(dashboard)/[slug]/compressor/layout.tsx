import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default async function CompressorLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <DashboardShell roleSlug="compressor" slug={slug}>
      {children}
    </DashboardShell>
  )
}
