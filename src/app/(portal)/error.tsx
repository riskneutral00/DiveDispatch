'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { GlassErrorCard } from '@/components/glass/glass-error-card'

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
    <GlassErrorCard
      icon={AlertTriangle}
      title="Something went wrong"
      message="We couldn't load your booking form. Please try the link again or contact your dive center."
    />
  )
}
