'use client'

import { use } from 'react'
import { DashboardContent } from '@/components/layout/dashboard-content'

export default function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string; roleSlug: string }>
}) {
  const { roleSlug, slug } = use(params)
  return <DashboardContent roleSlug={roleSlug} slug={slug} />
}
