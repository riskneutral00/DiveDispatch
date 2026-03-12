import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { PoolProfileForm } from '@/components/dashboard/pool-profile-form'
import type { RoleKey } from '@/lib/constants/roles'

export default async function PoolSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <DashboardShell roleSlug={'pool' as RoleKey} slug={slug}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            Settings
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Manage your pool profile and contact details.
          </p>
        </div>

        <PoolProfileForm />
      </div>
    </DashboardShell>
  )
}
