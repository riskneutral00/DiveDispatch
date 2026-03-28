'use client'

import { SessionDashboardShell } from '@/components/dashboard/session-dashboard-shell'
import { DirectoryShell } from '@/components/directory/directory-shell'

export function DirectoryPageClient() {
  return (
    <SessionDashboardShell>
      <DirectoryShell />
    </SessionDashboardShell>
  )
}
