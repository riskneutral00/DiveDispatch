'use client'

import { useState, useEffect } from 'react'
import { useMutation, useAction, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { GlassDialog, GlassButton, ErrorAlert } from '@/components/ui'
import { parseConvexError } from '@/lib/utils/convex-error'
import { COPY_FEEDBACK_MS, PORTAL_LINK_EXPIRY_MS } from '@/lib/constants/ui-timings'
import { GENERATE_LINK_ERROR_MESSAGE } from '@/lib/constants/error-messages'
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
  return `Hi ${customerName}, ${operatorName} has created a dive booking for you. Please complete your details here:\n\n${portalUrl}`
}

export function SendPortalLink({
  bookingId,
  customerName,
  email,
  operatorName,
  contactType,
  contactValue,
}: SendPortalLinkProps) {
  const [open, setOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [copyDone, setCopyDone] = useState(false)
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

  useEffect(() => {
    if (!copyDone) return
    const timer = setTimeout(() => setCopyDone(false), COPY_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [copyDone])

  async function ensureLink(channel?: Channel): Promise<string | null> {
    if (resolvedUrl) return resolvedUrl
    try {
      const token = await createLink({ bookingId, customerName, email, channel })
      const url = `${window.location.origin}/portal/${token}`
      const expiry = Date.now() + PORTAL_LINK_EXPIRY_MS
      setLinkUrl(url)
      setExpiresAt(expiry)
      return url
    } catch (e) {
      setError(parseConvexError(e, GENERATE_LINK_ERROR_MESSAGE))
      return null
    }
  }

  async function handleCopy() {
    setError(null)
    setBusy('copy')
    const url = await ensureLink()
    if (!url) { setBusy(null); return }
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      } else {
        const el = document.createElement('textarea')
        el.value = url
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      setCopyDone(true)
    } catch {
      setError('Clipboard access denied. Copy the link manually.')
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
    } catch (e) {
      setError(parseConvexError(e, 'Failed to send email'))
    } finally {
      setBusy(null)
    }
  }

  async function handleSendWhatsApp() {
    setError(null)
    setBusy('whatsapp')
    const phone = contactType === 'whatsapp' ? contactValue : undefined
    if (!phone) {
      setError('No WhatsApp number available for this customer')
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
    setCopyDone(false)
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
    ? `Link expires: ${new Date(resolvedExpiry).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })}`
    : null

  const hasWhatsApp = contactType === 'whatsapp' && !!contactValue
  const hasLine = contactType === 'line' && !!contactValue
  const hasEmail = !!email
  const isSent = sentChannel !== null

  return (
    <>
      <GlassButton size="sm" variant="secondary" onClick={handleOpen}>
        <Link2 size={14} />
        Send Portal Link
      </GlassButton>

      <GlassDialog
        open={open}
        onClose={handleClose}
        title="Send Portal Link"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-primary">
              {customerName}
            </p>
            <p className="text-xs text-secondary">
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
              className="text-xs font-mono p-2 rounded break-all text-secondary"
              style={{ background: 'var(--color-glass-bg)',
                border: '1px solid var(--color-glass-border)' }}
            >
              {resolvedUrl}
            </div>
          )}

          {expiryLabel && (
            <p className="text-xs text-secondary">
              {expiryLabel}
            </p>
          )}

          {error && (
            <ErrorAlert className="text-xs">{error}</ErrorAlert>
          )}

          {isSent && (
            <p className="text-xs text-success flex items-center gap-1.5">
              <Check size={12} />
              {sentChannel === 'email' && 'Email sent!'}
              {sentChannel === 'whatsapp' && 'WhatsApp opened!'}
              {sentChannel === 'line' && 'LINE opened!'}
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            <GlassButton
              size="sm"
              variant="secondary"
              onClick={handleCopy}
              loading={busy === 'copy'}
              disabled={busy !== null && busy !== 'copy'}
            >
              {copyDone ? <Check size={14} /> : <Copy size={14} />}
              {copyDone ? 'Copied!' : 'Copy Link'}
            </GlassButton>

            {hasWhatsApp && (
              <GlassButton
                size="sm"
                variant="primary"
                onClick={handleSendWhatsApp}
                loading={busy === 'whatsapp'}
                disabled={(busy !== null && busy !== 'whatsapp') || isSent}
              >
                <MessageCircle size={14} />
                WhatsApp
              </GlassButton>
            )}

            {hasLine && (
              <GlassButton
                size="sm"
                variant="primary"
                onClick={handleSendLine}
                loading={busy === 'line'}
                disabled={(busy !== null && busy !== 'line') || isSent}
              >
                <Send size={14} />
                LINE
              </GlassButton>
            )}

            {hasEmail && (
              <GlassButton
                size="sm"
                variant={hasWhatsApp || hasLine ? 'secondary' : 'primary'}
                onClick={handleSendEmail}
                loading={busy === 'email'}
                disabled={(busy !== null && busy !== 'email') || isSent}
              >
                <Mail size={14} />
                Email
              </GlassButton>
            )}
          </div>
        </div>
      </GlassDialog>
    </>
  )
}
