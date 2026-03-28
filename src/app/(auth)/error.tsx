'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Auth Error]', error)
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
          className="text-lg font-semibold mb-2 text-primary"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Authentication error
        </h2>
        <p className="text-sm mb-6 text-secondary">
          Something went wrong during sign in. Please try again.
        </p>
        <GlassButton onClick={reset}>Try again</GlassButton>
      </GlassCard>
    </div>
  )
}
