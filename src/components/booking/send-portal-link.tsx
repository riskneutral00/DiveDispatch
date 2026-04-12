'use client'

import { useState } from 'react'
import { useMutation, useAction, useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import { Dialog, Button, ErrorAlert } from '@/components/ui'
import { PORTAL_LINK_EXPIRY_MS } from '@/lib/constants/ui-timings'
import { useCopyFeedback } from '@/lib/hooks/use-copy-feedback'
import { formatDateLong, toISODateString } from '@/lib/utils/date'
import { Link2, Mail, Copy, Check, MessageCircle, Send } from 'lucide-react'

type Channel = 'email' | 'whatsapp' | 'line'

interface SendPortalLinkProps {
  bookingId: Id<'bookings'>
  customerName: string
  email: string
  operatorName: string
  contactType?: Channel
  contactValue?: string
}

type Busy = 'copy' | 'email' | 'whatsapp' | 'line' | null

function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^+\d]/g, '')
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}

function buildLineUrl(message: string): string {
  return `https://line.me/R/msg/text/?${encodeURIComponent(message)}`
}

function buildMessage(customerName: string, operatorName: string, portalUrl: string): string {
  return `Hi ${customerName}, ${operatorName} has booked you for a dive. Please complete your details here:\n\n${portalUrl}`
}

export function SendPortalLink({
  bookingId,
  customerName,
  email,
  operatorName,
  contactType,
  contactValue,
}: SendPortalLinkProps) {
  const tErrors = useTranslations('errors')
  const tCommon = useTranslations('common')
  const tBooking = useTranslations('booking')
  const [open, setOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [copyDone, markCopyDone] = useCopyFeedback()
  const [sentChannel, setSentChannel] = useState<Channel | null>(null)
  const [error, setError] = useState<string | null>(null)

  const existingLink = useQuery(
    api.bookingLinks.getByBookingId,
    open ? { bookingId } : 'skip',
  )
  const createLink = useMutation(api.bookingLinks.create)
  const sendEmail = useAction(api.email.sendBookingLinkEmail)

  const resolvedUrl =
    linkUrl ??
    (existingLink ? `${window.location.origin}/portal/${existingLink.token}` : null)
  const resolvedExpiry = expiresAt ?? existingLink?.expiresAt ?? null

  async function ensureLink(channel?: Channel): Promise<string | null> {
    if (resolvedUrl) return resolvedUrl
    try {
      const token = await createLink({ bookingId, customerName, email, channel })
      const url = `${window.location.origin}/portal/${token}`
      const expiry = Date.now() + PORTAL_LINK_EXPIRY_MS
      setLinkUrl(url)
      setExpiresAt(expiry)
      return url
    } catch {
      setError(tCommon('actionFailed', { action: 'Generate link' }))
      return null
    }
  }

  async function handleCopy() {
    setError(null)
    setBusy('copy')
    const url = await ensureLink()
    if (!url) { setBusy(null); return }
    try {
      await navigator.clipboard.writeText(url)
      markCopyDone()
    } catch {
      setError(tErrors('copyFailed'))
    } finally {
      setBusy(null)
    }
  }

  async function handleSendEmail() {
    setError(null)
    setBusy('email')
    const url = await ensureLink('email')
    if (!url) { setBusy(null); return }
    try {
      await sendEmail({
        to: email,
        customerName,
        operatorName,
        portalUrl: url,
        expiresAt: resolvedExpiry ?? Date.now() + PORTAL_LINK_EXPIRY_MS,
      })
      setSentChannel('email')
    } catch {
      setError(tCommon('actionFailed', { action: 'Send email' }))
    } finally {
      setBusy(null)
    }
  }

  async function handleSendWhatsApp() {
    setError(null)
    setBusy('whatsapp')
    const phone = contactType === 'whatsapp' ? contactValue : undefined
    if (!phone) {
      setError(tErrors('noWhatsApp'))
      setBusy(null)
      return
    }
    const url = await ensureLink('whatsapp')
    if (!url) { setBusy(null); return }
    const message = buildMessage(customerName, operatorName, url)
    window.open(buildWhatsAppUrl(phone, message), '_blank')
    setSentChannel('whatsapp')
    setBusy(null)
  }

  async function handleSendLine() {
    setError(null)
    setBusy('line')
    const url = await ensureLink('line')
    if (!url) { setBusy(null); return }
    const message = buildMessage(customerName, operatorName, url)
    window.open(buildLineUrl(message), '_blank')
    setSentChannel('line')
    setBusy(null)
  }

  function resetState() {
    setLinkUrl(null)
    setExpiresAt(null)
    setBusy(null)
    setSentChannel(null)
    setError(null)
  }

  function handleOpen() {
    resetState()
    setOpen(true)
  }

  function handleClose() {
    resetState()
    setOpen(false)
  }

  const expiryLabel = resolvedExpiry
    ? tBooking('linkExpires', {
        date: formatDateLong(toISODateString(new Date(resolvedExpiry))),
      })
    : null

  const hasWhatsApp = contactType === 'whatsapp' && !!contactValue
  const hasLine = contactType === 'line' && !!contactValue
  const hasEmail = !!email
  const isSent = sentChannel !== null

  return (
    <>
      <Button size="sm" variant="secondary" onClick={handleOpen}>
        <Link2 size={14} />
        {tCommon('sendLink')}
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        title={tCommon('sendLink')}
        size="sm"
        melt={false}
      >
        <div className="space-y-4">
          <div>
            <p className="text-body font-medium text-primary">
              {customerName}
            </p>
            <p className="text-label text-secondary">
              {contactType === 'whatsapp' && contactValue
                ? `WhatsApp: ${contactValue}`
                : contactType === 'line' && contactValue
                  ? `LINE: ${contactValue}`
                  : email}
            </p>
          </div>

          {resolvedUrl && (
            <div
              data-testid="portal-link-url"
              className="text-label font-mono p-2 rounded-[var(--border-radius-button)] break-all text-secondary bg-glass-bg border border-glass-border"
            >
              {resolvedUrl}
            </div>
          )}

          {expiryLabel && (
            <p className="text-label text-secondary">
              {expiryLabel}
            </p>
          )}

          {error && (
            <ErrorAlert size="sm">{error}</ErrorAlert>
          )}

          {isSent && (
            <p className="text-label text-success flex items-center gap-1.5">
              <Check size={12} />
              {sentChannel === 'email' && tBooking('emailSent')}
              {sentChannel === 'whatsapp' && tBooking('whatsAppOpened')}
              {sentChannel === 'line' && tBooking('lineOpened')}
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopy}
              loading={busy === 'copy'}
              disabled={busy !== null && busy !== 'copy'}
            >
              {copyDone ? <Check size={14} /> : <Copy size={14} />}
              {copyDone ? tCommon('copied') : tCommon('copy')}
            </Button>

            {hasWhatsApp && (
              <Button
                size="sm"
                variant="primary"
                onClick={handleSendWhatsApp}
                loading={busy === 'whatsapp'}
                disabled={(busy !== null && busy !== 'whatsapp') || isSent}
              >
                <MessageCircle size={14} />
                WhatsApp
              </Button>
            )}

            {hasLine && (
              <Button
                size="sm"
                variant="primary"
                onClick={handleSendLine}
                loading={busy === 'line'}
                disabled={(busy !== null && busy !== 'line') || isSent}
              >
                <Send size={14} />
                LINE
              </Button>
            )}

            {hasEmail && (
              <Button
                size="sm"
                variant={hasWhatsApp || hasLine ? 'secondary' : 'primary'}
                onClick={handleSendEmail}
                loading={busy === 'email'}
                disabled={(busy !== null && busy !== 'email') || isSent}
              >
                <Mail size={14} />
                Email
              </Button>
            )}
          </div>
        </div>
      </Dialog>
    </>
  )
}
