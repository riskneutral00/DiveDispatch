'use client'

import { use } from 'react'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

// Fallback for any non-standard roleSlug that doesn't match a static role directory.
export default function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string; roleSlug: string }>
}) {
  const { roleSlug, slug } = use(params)
  return <DashboardContent roleSlug={roleSlug} slug={slug} />
}
