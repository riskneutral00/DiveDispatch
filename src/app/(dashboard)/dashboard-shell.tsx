'use client'

import { DevSwitcher } from '@/components/dev/dev-switcher'
import { DevSwitchProvider } from '@/components/dev/dev-switch-context'

export function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DevSwitchProvider>
      <div className="min-h-screen">
        <div className="bg-image" />
        <div className="app-shell flex flex-col min-h-screen">
          {children}
        </div>
      </div>
      <DevSwitcher />
    </DevSwitchProvider>
  )
}
