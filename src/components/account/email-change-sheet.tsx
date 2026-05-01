'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useUser } from '@clerk/nextjs'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { EmailField } from '@/components/ui/email-field'
import { Input } from '@/components/ui/input'

interface EmailChangeSheetProps {
  open: boolean
  onClose: () => void
}

type Step = 'enter' | 'verify'

export function EmailChangeSheet({ open, onClose }: EmailChangeSheetProps) {
  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const { user } = useUser()

  const [step, setStep] = useState<Step>('enter')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setStep('enter')
    setEmail('')
    setCode('')
    setPendingId(null)
    setError(undefined)
    setBusy(false)
  }

  const close = () => {
    reset()
    onClose()
  }

  const sendCode = async () => {
    if (!user) return
    setError(undefined)
    setBusy(true)
    try {
      const created = await user.createEmailAddress({ email: email.trim().toLowerCase() })
      await created.prepareVerification({ strategy: 'email_code' })
      setPendingId(created.id ?? null)
      setStep('verify')
    } catch (e) {
      const msg = e instanceof Error ? e.message : tCommon('actionFailed', { action: tAuth('sendCode') })
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  const verifyCode = async () => {
    if (!user || !pendingId) return
    setError(undefined)
    setBusy(true)
    try {
      const target = user.emailAddresses.find((e) => e.id === pendingId)
      if (!target) throw new Error(tAuth('emailVerificationFailed'))
      await target.attemptVerification({ code: code.trim() })
      await user.update({ primaryEmailAddressId: target.id })
      const previousPrimaryId = user.primaryEmailAddressId
      if (previousPrimaryId && previousPrimaryId !== target.id) {
        const previous = user.emailAddresses.find((e) => e.id === previousPrimaryId)
        await previous?.destroy()
      }
      await user.reload()
      close()
    } catch (e) {
      const msg = e instanceof Error ? e.message : tAuth('emailVerificationFailed')
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={tAuth('changeEmail')}
      size="sm"
    >
      <div className="space-y-4">
        {step === 'enter' && (
          <EmailField
            label={tAuth('newEmailLabel')}
            value={email}
            onChange={setEmail}
            error={error}
            required
            autoFocus
          />
        )}
        {step === 'verify' && (
          <div className="space-y-2">
            <p className="text-body text-secondary">
              {tAuth('codeSentTo', { email })}
            </p>
            <Input
              label={tAuth('verifyCodeLabel')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              error={error}
              required
              autoFocus
              className="field-md"
            />
          </div>
        )}
      </div>
      {step === 'enter' ? (
        <DialogFooter
          primaryLabel={tAuth('sendCode')}
          onPrimary={sendCode}
          primaryDisabled={busy || !email.trim()}
          primaryLoading={busy}
          secondaryLabel={tCommon('cancel')}
          onSecondary={close}
        />
      ) : (
        <DialogFooter
          primaryLabel={tAuth('verifyCode')}
          onPrimary={verifyCode}
          primaryDisabled={busy || !code.trim()}
          primaryLoading={busy}
          secondaryLabel={tCommon('cancel')}
          onSecondary={close}
        />
      )}
    </Dialog>
  )
}
