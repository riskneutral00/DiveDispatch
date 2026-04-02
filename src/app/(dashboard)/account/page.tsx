import { AccountForm } from '@/components/account/account-form'
import { DashboardPageFrame } from '@/components/layout/dashboard-page-frame'
import { SessionDashboardShell } from '@/components/layout/session-dashboard-shell'

export default function AccountPage() {
  return (
    <SessionDashboardShell>
      <DashboardPageFrame maxWidth="lg" padding="none" title="Account">
        <AccountForm />
      </DashboardPageFrame>
    </SessionDashboardShell>
  )
}
