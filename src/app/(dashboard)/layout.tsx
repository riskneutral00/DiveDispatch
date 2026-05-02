import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/lib/convex-generated'
import { DashboardGroupLayout } from './dashboard-shell'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId, getToken } = await auth()
  if (!userId) redirect('/sign-in')

  const token = await getToken({ template: 'convex' })
  if (!token) redirect('/sign-in')

  const [user, roles] = await Promise.all([
    fetchQuery(api.users.me, {}, { token }),
    fetchQuery(api.userRoles.myRoles, {}, { token }),
  ])

  if (!user || roles.length === 0) redirect('/sign-up')

  return <DashboardGroupLayout>{children}</DashboardGroupLayout>
}
