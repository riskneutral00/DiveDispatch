import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { DashboardClientRedirect } from './_lib/dashboard-client-redirect'

export default async function DashboardRedirectPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }
  return <DashboardClientRedirect />
}
