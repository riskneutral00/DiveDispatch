import { useState, useEffect, useCallback } from 'react'
import { parseConvexError } from '@/lib/utils/convex-error'

interface UseOrganizerFormStepOptions {
  /** Called once to prefill form state from existing data. Return void. */
  prefill: () => void
  /** Deps for the prefill effect — when these change and are truthy, prefill runs. */
  prefillReady: boolean
  /** Async save function. Throw on failure. */
  save: () => Promise<void>
  /** Called after successful save. */
  onSaved: () => void
}

export function useOrganizerFormStep({ prefill, prefillReady, save, onSaved }: UseOrganizerFormStepOptions) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (prefillReady && !initialized) {
      prefill()
      setInitialized(true)
    }
  }, [prefillReady, initialized, prefill])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      await save()
      onSaved()
    } catch (err) {
      setError(parseConvexError(err, 'Save failed'))
    } finally {
      setSaving(false)
    }
  }, [save, onSaved])

  return { saving, error, initialized, handleSave }
}
