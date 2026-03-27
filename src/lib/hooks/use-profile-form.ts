'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { z } from 'zod'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

type ProfileRecord = Record<string, unknown>

export interface UseProfileFormOptions<
  TForm extends Record<string, unknown>,
  TPayload = Record<string, unknown>,
> {
  /** Convex query result — undefined while loading, null if no profile exists */
  profile: ProfileRecord | null | undefined
  /** Optional user record for pre-filling defaults on first create */
  me?: { businessName?: string; email?: string; phone?: string; customerLanguages?: string[]; defaultLocation?: string } | null | undefined
  /** Zod schema for validation */
  schema: z.ZodType<unknown>
  /** Default form values */
  defaults: TForm
  /** Map profile data → form state (called once when profile loads) */
  fromProfile: (profile: ProfileRecord) => TForm
  /** Map form state → mutation payload (called on submit) */
  toPayload: (form: TForm) => TPayload
  /** Create mutation */
  create: (payload: TPayload) => Promise<unknown>
  /** Update mutation */
  update: (payload: TPayload) => Promise<unknown>
  /** Called after successful save */
  onSaved?: () => void
  /** Optional: pre-fill from `me` when no profile exists */
  fromMe?: (me: NonNullable<UseProfileFormOptions<TForm, TPayload>['me']>, defaults: TForm) => TForm
}

export interface UseProfileFormReturn<TForm extends Record<string, unknown>> {
  /** Current form values */
  form: TForm
  /** Set entire form */
  setForm: React.Dispatch<React.SetStateAction<TForm>>
  /** Set a single field (clears its error) */
  setField: <K extends keyof TForm>(key: K, value: TForm[K]) => void
  /** Per-field validation errors */
  errors: Record<string, string>
  /** Server-side error message */
  serverError: string | null
  /** Whether a save is in progress */
  saving: boolean
  /** Whether the last save succeeded */
  saved: boolean
  /** Whether the form has unsaved changes relative to the loaded state */
  isDirty: boolean
  /** Whether all required fields pass schema validation */
  isValid: boolean
  /** Whether the profile is still loading from Convex */
  loading: boolean
  /** Whether an existing profile was found */
  isUpdate: boolean
  /** Form submit handler — pass to <form onSubmit> */
  handleSubmit: (e: React.FormEvent) => Promise<void>
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useProfileForm<
  TForm extends Record<string, unknown>,
  TPayload = Record<string, unknown>,
>(
  options: UseProfileFormOptions<TForm, TPayload>,
): UseProfileFormReturn<TForm> {
  const { profile, me, schema, defaults, fromProfile, toPayload, create, update, onSaved, fromMe } = options

  const [form, setForm] = useState<TForm>(defaults)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Baseline snapshot for dirty-checking — updated on init and after save
  const baselineRef = useRef<TForm>(defaults)

  const isDirty = useCallback(() => {
    return JSON.stringify(form) !== JSON.stringify(baselineRef.current)
  }, [form])

  // Initialize form from profile (once)
  useEffect(() => {
    if (profile !== undefined && !initialized) {
      let initial = defaults
      if (profile) {
        initial = fromProfile(profile)
      } else if (me && fromMe) {
        initial = fromMe(me, defaults)
      }
      setForm(initial)
      baselineRef.current = initial
      setInitialized(true)
    }
  }, [profile, me, initialized, fromProfile, fromMe, defaults])

  function setField<K extends keyof TForm>(key: K, value: TForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    if (errors[key as string]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key as string]
        return next
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)
    setServerError(null)

    const result = schema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of (result as { success: false; error: z.ZodError }).error.issues) {
        const path = issue.path.join('.')
        if (!fieldErrors[path]) fieldErrors[path] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    const payload = toPayload(form)

    setSaving(true)
    try {
      if (profile) {
        await update(payload)
      } else {
        await create(payload)
      }
      baselineRef.current = form
      setSaved(true)
      toast.success('Profile saved', { duration: 3000 })
      onSaved?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed'
      setServerError(message)
      toast.error('Save failed', { description: message, duration: 5000 })
    } finally {
      setSaving(false)
    }
  }

  const isValid = schema.safeParse(form).success

  return {
    form,
    setForm,
    setField,
    errors,
    serverError,
    saving,
    saved,
    isDirty: isDirty(),
    isValid,
    loading: profile === undefined,
    isUpdate: !!profile,
    handleSubmit,
  }
}
