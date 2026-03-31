'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { GlassErrorCard } from '@/components/ui/glass-error-card'
import { GlassButton } from '@/components/ui/glass-button'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Root Error]', error)
  }, [error])

  return (
    <GlassErrorCard
      icon={AlertTriangle}
      title="Something went wrong"
      message="An unexpected error occurred. Try refreshing the page or contact support if this persists."
      action={<GlassButton onClick={reset}>Try again</GlassButton>}
    />
  )
}
