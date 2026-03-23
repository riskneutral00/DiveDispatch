'use client'

import { use } from 'react'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

export default function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  return <DashboardContent roleSlug="dive-master" slug={slug} />
}
