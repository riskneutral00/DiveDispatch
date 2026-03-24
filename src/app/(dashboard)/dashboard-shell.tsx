'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { DevSwitcher } from '@/components/dev/dev-switcher'
import { DevSwitchProvider } from '@/components/dev/dev-switch-context'
import { useCurrentUser } from '@/lib/hooks/use-current-user'

function OnboardingBanner() {
  const { user, isLoading } = useCurrentUser()
  const pathname = usePathname()
  const router = useRouter()

  // Completed user who somehow lands on /onboarding → send to dashboard
  useEffect(() => {
    if (!isLoading && user?.onboardingComplete && pathname === '/onboarding') {
      router.replace('/')
    }
  }, [user, isLoading, router, pathname])

  // Don't show banner on /onboarding itself or for seeded/complete users
  if (
    isLoading ||
    !user ||
    user.isSeeded ||
    user.onboardingComplete ||
    pathname === '/onboarding'
  ) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: 'var(--color-warning-bg)',
        borderBottom: '1px solid var(--color-warning-border)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontSize: 13,
        color: 'var(--color-text-primary)',
      }}
    >
      <span>Complete your profile to start creating or receiving bookings.</span>
      <Link
        href="/onboarding"
        style={{
          fontWeight: 600,
          color: 'var(--color-primary)',
          textDecoration: 'underline',
          whiteSpace: 'nowrap',
        }}
      >
        Complete profile →
      </Link>
    </div>
  )
}

// Dashboard route group — auth is enforced by proxy (clerkMiddleware).
// Onboarding is optional — users land on dashboard immediately after role selection.
// A banner prompts incomplete users to finish their profile before booking.
export function DashboardGroupLayout({
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
          <OnboardingBanner />
          {children}
        </div>
      </div>
      <DevSwitcher />
    </DevSwitchProvider>
  )
}
