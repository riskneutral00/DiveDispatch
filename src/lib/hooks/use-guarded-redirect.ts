'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export interface GuardedRedirectOptions {
  to: string | null
  enabled?: boolean
  replace?: boolean
}

export function useGuardedRedirect({
  to,
  enabled = true,
  replace = true,
}: GuardedRedirectOptions): void {
  const router = useRouter()
  useEffect(() => {
    if (!enabled || !to) return
    if (replace) router.replace(to)
    else router.push(to)
  }, [enabled, to, replace, router])
}
