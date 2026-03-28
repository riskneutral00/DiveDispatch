import { AccountForm } from '@/components/dashboard/account-form'
import { SessionDashboardShell } from '@/components/dashboard/session-dashboard-shell'
import { PageTitle } from '@/components/common/page-title'

export default function AccountPage() {
  return (
    <SessionDashboardShell>
      <div className="w-full max-w-lg mx-auto">
        <PageTitle title="Account" />
        <AccountForm />
      </div>
    </SessionDashboardShell>
  )
}
