import { notFound } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'

export default async function RoleSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ roleSlug: string; slug: string }>
}) {
  const { roleSlug, slug } = await params

  if (!ROLE_BY_KEY[roleSlug as RoleKey]) notFound()

  return (
    <DashboardShell roleSlug={roleSlug as RoleKey} slug={slug}>
      {children}
    </DashboardShell>
  )
}
