import { Package } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { EquipmentProfileForm } from '@/components/dashboard/equipment-profile-form'
import { PreferencesEditor } from '@/components/dashboard/preferences-editor'

export default async function EquipmentSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <DashboardShell roleSlug="equipment" slug={slug}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Package size={28} style={{ color: 'var(--color-primary)' }} />
          <div>
            <h1
              className="text-2xl font-bold"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'var(--color-text-primary)',
              }}
            >
              Equipment Profile
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Your gear rental profile — visible to dive centers and instructors in the directory.
            </p>
          </div>
        </div>
        <EquipmentProfileForm />
        <PreferencesEditor />
      </div>
    </DashboardShell>
  )
}
