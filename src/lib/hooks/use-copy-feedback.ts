'use client'

import { useEffect, useState } from 'react'
import { COPY_FEEDBACK_MS } from '@/lib/constants/ui-timings'

/**
 * Returns a `[copied, markCopied]` tuple. After calling `markCopied()`,
 * `copied` flips to true then automatically resets after `ms` milliseconds.
 */
export function useCopyFeedback(ms = COPY_FEEDBACK_MS) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), ms)
    return () => clearTimeout(timer)
  }, [copied, ms])

  return [copied, () => setCopied(true)] as const
}
