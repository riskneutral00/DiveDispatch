import type { Metadata } from 'next'
import { DashboardGroupLayout } from './dashboard-shell'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardGroupLayout>{children}</DashboardGroupLayout>
}
