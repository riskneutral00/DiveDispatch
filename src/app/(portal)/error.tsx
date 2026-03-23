'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { GlassCard } from '@/components/glass/glass-card'

export default function PortalError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Portal Error]', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <GlassCard className="max-w-md w-full p-8 text-center">
        <AlertTriangle
          size={40}
          className="mx-auto mb-4"
          style={{ color: 'var(--color-destructive)' }}
        />
        <h2
          className="text-lg font-semibold mb-2"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
        >
          Something went wrong
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          We couldn&apos;t load your booking form. Please try the link again or contact your dive center.
        </p>
      </GlassCard>
    </div>
  )
}
