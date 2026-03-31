'use client'

import { SessionDashboardShell } from '@/components/layout/session-dashboard-shell'
import { DirectoryShell } from '@/components/directory/directory-shell'

export function DirectoryPageClient() {
  return (
    <SessionDashboardShell>
      <DirectoryShell />
    </SessionDashboardShell>
  )
}
