'use client'

import { useEffect, useState } from 'react'
import type { z } from 'zod'

// ─── Types ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProfile = Record<string, any>

export interface UseProfileFormOptions<TForm extends Record<string, unknown>> {
  /** Convex query result — undefined while loading, null if no profile exists */
  profile: AnyProfile | null | undefined
  /** Optional user record for pre-filling defaults on first create */
  me?: { businessName?: string; email?: string; customerLanguages?: string[] } | null | undefined
  /** Zod schema for validation */
  schema: z.ZodType<unknown>
  /** Default form values */
  defaults: TForm
  /** Map profile data → form state (called once when profile loads) */
  fromProfile: (profile: AnyProfile) => TForm
  /** Map form state → mutation payload (called on submit) */
  toPayload: (form: TForm) => Record<string, unknown>
  /** Create mutation */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (payload: any) => Promise<unknown>
  /** Update mutation */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (payload: any) => Promise<unknown>
  /** Called after successful save */
  onSaved?: () => void
  /** Optional: pre-fill from `me` when no profile exists */
  fromMe?: (me: NonNullable<UseProfileFormOptions<TForm>['me']>, defaults: TForm) => TForm
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
  /** Whether the profile is still loading from Convex */
  loading: boolean
  /** Whether an existing profile was found */
  isUpdate: boolean
  /** Form submit handler — pass to <form onSubmit> */
  handleSubmit: (e: React.FormEvent) => Promise<void>
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useProfileForm<TForm extends Record<string, unknown>>(
  options: UseProfileFormOptions<TForm>,
): UseProfileFormReturn<TForm> {
  const { profile, me, schema, defaults, fromProfile, toPayload, create, update, onSaved, fromMe } = options

  const [form, setForm] = useState<TForm>(defaults)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Initialize form from profile (once)
  useEffect(() => {
    if (profile !== undefined && !initialized) {
      if (profile) {
        setForm(fromProfile(profile))
      } else if (me && fromMe) {
        setForm(fromMe(me, defaults))
      }
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
      setSaved(true)
      onSaved?.()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setServerError(err.message)
      } else {
        setServerError('Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  return {
    form,
    setForm,
    setField,
    errors,
    serverError,
    saving,
    saved,
    loading: profile === undefined,
    isUpdate: !!profile,
    handleSubmit,
  }
}
