'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { DevSwitcher } from '@/components/dev/dev-switcher'
import { DevSwitchProvider } from '@/components/dev/dev-switch-context'
import { useCurrentUser } from '@/lib/hooks/use-current-user'

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useCurrentUser()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading) return
    if (!user) return // middleware handles auth; no user = not yet registered

    const isOnboarding = pathname === '/onboarding'

    if (!user.onboardingComplete && !user.isSeeded && !isOnboarding) {
      // New user who hasn't completed onboarding — send to wizard
      router.replace('/onboarding')
    } else if (user.onboardingComplete && isOnboarding) {
      // Completed but somehow landed on /onboarding — skip to dashboard
      router.replace('/')
    }
  }, [user, isLoading, router, pathname])

  return <>{children}</>
}

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
          <OnboardingGuard>
            {children}
          </OnboardingGuard>
        </div>
      </div>
      <DevSwitcher />
    </DevSwitchProvider>
  )
}
