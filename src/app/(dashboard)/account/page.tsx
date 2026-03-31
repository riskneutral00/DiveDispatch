import { AccountForm } from '@/components/settings/account-form'
import { SessionDashboardShell } from '@/components/layout/session-dashboard-shell'
import { PageTitle } from '@/components/ui/page-title'

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
