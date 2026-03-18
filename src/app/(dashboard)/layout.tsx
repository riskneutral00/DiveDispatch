import { DevSwitcher } from '@/components/dev/dev-switcher'
import { DevSwitchProvider } from '@/components/dev/dev-switch-context'

// Dashboard route group — auth is enforced by middleware (clerkMiddleware).
// This layout is a passthrough; inner [roleSlug]/[slug] layouts add the shell.
export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DevSwitchProvider>
      <div className="min-h-screen">
        <div className="bg-image" />
        <div className="bg-overlay" />
        <div className="app-shell flex flex-col min-h-screen">
          {children}
        </div>
      </div>
      <DevSwitcher />
    </DevSwitchProvider>
  )
}
