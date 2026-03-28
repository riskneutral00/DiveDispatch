'use client'

import { useState } from 'react'
import { useMutation, useAction, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { GlassDialog, GlassButton } from '@/components/glass'
import { parseConvexError } from '@/lib/utils/convex-error'
import { COPY_FEEDBACK_MS, PORTAL_LINK_EXPIRY_MS } from '@/lib/constants/ui-timings'
import { GENERATE_LINK_ERROR_MESSAGE } from '@/lib/constants/error-messages'
import { Link2, Mail, Copy, Check } from 'lucide-react'

interface SendPortalLinkProps {
  bookingId: Id<'bookings'>
  customerName: string
  email: string
  operatorName: string
}

type Busy = 'copy' | 'email' | null

export function SendPortalLink({
  bookingId,
  customerName,
  email,
  operatorName,
}: SendPortalLinkProps) {
  const [open, setOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [copyDone, setCopyDone] = useState(false)
  const [emailDone, setEmailDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const existingLink = useQuery(
    api.bookingLinks.getByBookingId,
    open ? { bookingId } : 'skip',
  )
  const createLink = useMutation(api.bookingLinks.create)
  const sendEmail = useAction(api.email.sendBookingLinkEmail)

  // Prefer local state (set after create/copy) over query result
  const resolvedUrl =
    linkUrl ??
    (existingLink ? `${window.location.origin}/portal/${existingLink.token}` : null)
  const resolvedExpiry = expiresAt ?? existingLink?.expiresAt ?? null

  async function ensureLink(): Promise<string | null> {
    if (resolvedUrl) return resolvedUrl
    try {
      const token = await createLink({ bookingId, customerName, email })
      const url = `${window.location.origin}/portal/${token}`
      // 30-day TTL matches bookingLinks._createLink; estimate for display only
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
    if (!url) {
      setBusy(null)
      return
    }
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      } else {
        // Fallback for older browsers
        const el = document.createElement('textarea')
        el.value = url
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), COPY_FEEDBACK_MS)
    } catch {
      setError('Clipboard access denied. Copy the link manually.')
    } finally {
      setBusy(null)
    }
  }

  async function handleSendEmail() {
    setError(null)
    setBusy('email')
    const url = await ensureLink()
    if (!url) {
      setBusy(null)
      return
    }
    try {
      await sendEmail({
        to: email,
        customerName,
        operatorName,
        portalUrl: url,
        expiresAt: resolvedExpiry ?? Date.now() + PORTAL_LINK_EXPIRY_MS,
      })
      setEmailDone(true)
    } catch (e) {
      setError(parseConvexError(e, 'Failed to send email'))
    } finally {
      setBusy(null)
    }
  }

  function resetState() {
    setLinkUrl(null)
    setExpiresAt(null)
    setBusy(null)
    setCopyDone(false)
    setEmailDone(false)
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
          {/* Customer info */}
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {customerName}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {email}
            </p>
          </div>

          {/* Link preview */}
          {resolvedUrl && (
            <div
              data-testid="portal-link-url"
              className="text-xs font-mono p-2 rounded break-all"
              style={{
                background: 'var(--color-glass-bg)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-glass-border)',
              }}
            >
              {resolvedUrl}
            </div>
          )}

          {/* Expiry */}
          {expiryLabel && (
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {expiryLabel}
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs" role="alert" style={{ color: 'var(--color-destructive)' }}>
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <GlassButton
              size="sm"
              variant="secondary"
              onClick={handleCopy}
              loading={busy === 'copy'}
              disabled={busy === 'email' || emailDone}
            >
              {copyDone ? <Check size={14} /> : <Copy size={14} />}
              {copyDone ? 'Copied!' : 'Copy Link'}
            </GlassButton>

            <GlassButton
              size="sm"
              variant="primary"
              onClick={handleSendEmail}
              loading={busy === 'email'}
              disabled={busy === 'copy' || emailDone}
            >
              <Mail size={14} />
              {emailDone ? 'Email Sent!' : 'Send Email'}
            </GlassButton>
          </div>
        </div>
      </GlassDialog>
    </>
  )
}
