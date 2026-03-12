import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import type { RoleKey } from '@/lib/constants/roles'

export default async function RoleSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ roleSlug: string; slug: string }>
}) {
  const { roleSlug, slug } = await params

  return (
    <DashboardShell roleSlug={roleSlug as RoleKey} slug={slug}>
      {children}
    </DashboardShell>
  )
}
