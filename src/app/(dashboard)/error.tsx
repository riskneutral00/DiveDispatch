'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
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
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          An unexpected error occurred. Try refreshing or contact support if this persists.
        </p>
        <GlassButton onClick={reset}>Try again</GlassButton>
      </GlassCard>
    </div>
  )
}
