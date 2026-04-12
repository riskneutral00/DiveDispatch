'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { z } from 'zod'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { SAVE_FEEDBACK_MS } from '@/lib/constants/ui-timings'
import { parseConvexError } from '@/lib/utils/convex-error'
import { isDirtyComparedToSnapshot } from '@/lib/utils/form-baseline'
import { zodIssuesToFieldErrors } from '@/lib/validation/zod-helpers'

type ProfileRecord = Record<string, unknown>

export interface UseProfileFormOptions<
  TForm extends Record<string, unknown>,
  TPayload = Record<string, unknown>,
> {
  profile: ProfileRecord | null | undefined
  me?: { businessName?: string; email?: string; phone?: string; customerLanguages?: string[]; defaultLocation?: string } | null | undefined
  schema: z.ZodType<unknown>
  defaults: TForm
  fromProfile: (profile: ProfileRecord, me?: NonNullable<UseProfileFormOptions<TForm, TPayload>['me']>) => TForm
  toPayload: (form: TForm) => TPayload
  create: (payload: TPayload) => Promise<unknown>
  update: (payload: TPayload) => Promise<unknown>
  onSaved?: () => void
  fromMe?: (me: NonNullable<UseProfileFormOptions<TForm, TPayload>['me']>, defaults: TForm) => TForm
  waitForMeBeforeInit?: boolean
  afterSuccessfulSave?: (form: TForm) => Promise<void>
}

export interface UseProfileFormReturn<TForm extends Record<string, unknown>> {
  form: TForm
  setForm: React.Dispatch<React.SetStateAction<TForm>>
  setField: <K extends keyof TForm>(key: K, value: TForm[K]) => void
  errors: Record<string, string>
  serverError: string | null
  footerErrorMessage: string | null
  saving: boolean
  saved: boolean
  isDirty: boolean
  isValid: boolean
  loading: boolean
  isUpdate: boolean
  handleSubmit: (e: React.FormEvent) => Promise<void>
  markBaselineCurrent: () => void
  resetToBaseline: () => void
}

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

  const t = useTranslations('common')
  const [form, setForm] = useState<TForm>(defaults)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const baselineRef = useRef<TForm>(defaults)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (saved) {
      savedTimerRef.current = setTimeout(() => setSaved(false), SAVE_FEEDBACK_MS)
      return () => clearTimeout(savedTimerRef.current)
    }
  }, [saved])

  const isDirty = useCallback(
    () => isDirtyComparedToSnapshot(form, baselineRef.current),
    [form],
  )

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
      setErrors(zodIssuesToFieldErrors(result.error.issues))
      toast.warning(t('fixHighlightedFields'), { duration: 4000 })
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
      onSaved?.()

      if (afterSuccessfulSave) {
        try {
          await afterSuccessfulSave(form)
        } catch (secondaryErr: unknown) {
          const message = parseConvexError(secondaryErr, t('actionFailed', { action: t('save') }))
          toast.warning(t('profileSavedExtraStepFailed'), {
            description: message,
            duration: 6000,
          })
        }
      }
    } catch (err: unknown) {
      const message = parseConvexError(err, t('actionFailed', { action: t('save') }))
      setServerError(message)
      toast.error(t('actionFailed', { action: t('save') }), { description: message, duration: 5000 })
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

  const resetToBaseline = useCallback(() => {
    setForm(baselineRef.current)
    setErrors({})
    setServerError(null)
    setSaved(false)
  }, [])

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
      !initialized
      || profile === undefined
      || (waitForMeBeforeInit === true && me === undefined),
    isUpdate: !!profile,
    handleSubmit,
    markBaselineCurrent,
    resetToBaseline,
  }
}
