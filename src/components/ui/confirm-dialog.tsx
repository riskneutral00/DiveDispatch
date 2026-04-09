'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/error-alert'

interface ConfirmActionDialogProps {
  open: boolean
  onClose: () => void
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string | null
  variant?: 'destructive' | 'default'
  onConfirm: () => Promise<void>
  children?: ReactNode
}

export function ConfirmActionDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  onConfirm,
  children,
}: ConfirmActionDialogProps) {
  const t = useTranslations('common')
  const resolvedCancelLabel = cancelLabel ?? t('cancel')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    if (submitting) return
    setError(null)
    onClose()
  }

  async function handleConfirm() {
    setError(null)
    setSubmitting(true)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={title}
      description={description}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        {children}

        {error && <ErrorAlert>{error}</ErrorAlert>}

        <div className="flex justify-end gap-3 mt-1">
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={submitting}>
            {resolvedCancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'primary'}
            size="sm"
            onClick={handleConfirm}
            loading={submitting}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
