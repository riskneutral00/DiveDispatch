'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { z } from 'zod'
import { toast } from 'sonner'
import {
  FORM_SAVE_FAILED_TOAST,
  FORM_SAVE_SUCCESS_TOAST,
  FORM_SECONDARY_SAVE_WARNING_TITLE,
  FORM_VALIDATION_WARNING_TOAST,
} from '@/lib/profile-form/save-feedback'
import { parseConvexError } from '@/lib/utils/convex-error'
import { isDirtyComparedToSnapshot } from '@/lib/utils/form-baseline'

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
  fromProfile: (profile: ProfileRecord, me?: NonNullable<UseProfileFormOptions<TForm, TPayload>['me']>) => TForm
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
  /** When true, wait for `me` to be defined (not loading) before initializing the form. */
  waitForMeBeforeInit?: boolean
  /** Runs after create/update succeeds (e.g. sync `users.customerLanguages`) */
  afterSuccessfulSave?: (form: TForm) => Promise<void>
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
  /** Combined server + schema-level footer errors (`_form`, root path) for ProfileFormShell */
  footerErrorMessage: string | null
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
  /** Call after a successful save outside handleSubmit (e.g. per-section upsert) so isDirty resets. */
  markBaselineCurrent: () => void
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useProfileForm<
  TForm extends Record<string, unknown>,
  TPayload = Record<string, unknown>,
>(
  options: UseProfileFormOptions<TForm, TPayload>,
): UseProfileFormReturn<TForm> {
  const {
    profile,
    me,
    schema,
    defaults,
    fromProfile,
    toPayload,
    create,
    update,
    onSaved,
    fromMe,
    waitForMeBeforeInit,
    afterSuccessfulSave,
  } = options

  const [form, setForm] = useState<TForm>(defaults)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Baseline snapshot for dirty-checking — updated on init and after save
  const baselineRef = useRef<TForm>(defaults)

  const isDirty = useCallback(
    () => isDirtyComparedToSnapshot(form, baselineRef.current),
    [form],
  )

  // Initialize form from profile (once)
  useEffect(() => {
    if (profile === undefined) return
    if (waitForMeBeforeInit && me === undefined) return
    if (!initialized) {
      let initial = defaults
      if (profile) {
        initial = fromProfile(profile, me ?? undefined)
      } else if (me && fromMe) {
        initial = fromMe(me, defaults)
      }
      setForm(initial)
      baselineRef.current = initial
      setInitialized(true)
    }
  }, [profile, me, initialized, fromProfile, fromMe, defaults, waitForMeBeforeInit])

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
      for (const issue of result.error.issues) {
        const path = issue.path.join('.')
        if (!fieldErrors[path]) fieldErrors[path] = issue.message
      }
      setErrors(fieldErrors)
      toast.warning(FORM_VALIDATION_WARNING_TOAST, { duration: 4000 })
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
      toast.success(FORM_SAVE_SUCCESS_TOAST, { duration: 3000 })
      onSaved?.()

      if (afterSuccessfulSave) {
        try {
          await afterSuccessfulSave(form)
        } catch (secondaryErr: unknown) {
          const message = parseConvexError(secondaryErr, 'Sync failed')
          toast.warning(FORM_SECONDARY_SAVE_WARNING_TITLE, {
            description: message,
            duration: 6000,
          })
        }
      }
    } catch (err: unknown) {
      const message = parseConvexError(err, 'Save failed')
      setServerError(message)
      toast.error(FORM_SAVE_FAILED_TOAST, { description: message, duration: 5000 })
    } finally {
      setSaving(false)
    }
  }

  const isValid = schema.safeParse(form).success

  const footerErrorMessage =
    serverError ?? errors['_form'] ?? errors[''] ?? null

  const markBaselineCurrent = useCallback(() => {
    baselineRef.current = form
    setSaved(true)
  }, [form])

  return {
    form,
    setForm,
    setField,
    errors,
    serverError,
    footerErrorMessage,
    saving,
    saved,
    isDirty: isDirty(),
    isValid,
    loading:
      profile === undefined
      || (waitForMeBeforeInit === true && me === undefined),
    isUpdate: !!profile,
    handleSubmit,
    markBaselineCurrent,
  }
}
