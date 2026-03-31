'use client'

import { use } from 'react'
import { DashboardContent } from '@/components/layout/dashboard-content'

// Primary dashboard page — roleSlug is validated by the parent layout.
export default function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string; roleSlug: string }>
}) {
  const { roleSlug, slug } = use(params)
  return <DashboardContent roleSlug={roleSlug} slug={slug} />
}
