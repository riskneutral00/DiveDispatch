import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/lib/convex-generated'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'

export default async function SlugRoleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string; roleSlug: string }>
}) {
  const { slug, roleSlug } = await params

  if (!ROLE_BY_KEY[roleSlug as RoleKey]) notFound()

  const { getToken } = await auth()
  const token = await getToken({ template: 'convex' })
  if (!token) redirect('/sign-in')

  const user = await fetchQuery(api.users.me, {}, { token })
  if (!user) redirect('/sign-up')
  if (user.slug !== slug) redirect('/dashboard')

  return (
    <DashboardShell roleSlug={roleSlug as RoleKey} slug={slug}>
      {children}
    </DashboardShell>
  )
}
