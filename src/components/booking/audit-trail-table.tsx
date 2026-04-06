'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import {
  PlusCircle,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  CheckSquare,
  Edit2,
  Check,
  X,
  FileText,
  AlertCircle,
  Shield,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import type { AuditAction } from '../../../convex/bookingAuditLog'
import { timeAgo } from '@/lib/utils/time-ago'
import { Skeleton } from '@/components/ui/skeleton'
// ── Types ──────────────────────────────────────────────────────────────────────

interface AuditTrailTableProps {
  bookingId: string
}

type AuditEntry = {
  _id: string
  action: AuditAction
  actorSlug: string
  actorType: string
  timestamp: number
  diff?: string
  note?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function actionLabel(action: AuditAction): string {
  switch (action) {
    case 'created':
      return 'Booking created'
    case 'submitted':
      return 'Form submitted'
    case 'confirmed':
      return 'Booking confirmed'
    case 'cancelled':
      return 'Booking cancelled'
    case 'expired':
      return 'Hold expired'
    case 'completed':
      return 'Booking completed'
    case 'edited':
      return 'Booking edited'
    case 'reservation_accepted':
      return 'Reservation accepted'
    case 'reservation_declined':
      return 'Reservation declined'
    case 'portal_submitted':
      return 'Portal submitted'
    case 'medical_blocked':
      return 'Medical block applied'
    case 'medical_cleared':
      return 'Medical block cleared'
    default:
      return action
  }
}

function ActionIcon({ action }: { action: AuditAction }) {
  const size = 14
  switch (action) {
    case 'created':
      return <PlusCircle size={size} />
    case 'submitted':
      return <Send size={size} />
    case 'confirmed':
      return <CheckCircle size={size} />
    case 'cancelled':
      return <XCircle size={size} />
    case 'expired':
      return <Clock size={size} />
    case 'completed':
      return <CheckSquare size={size} />
    case 'edited':
      return <Edit2 size={size} />
    case 'reservation_accepted':
      return <Check size={size} />
    case 'reservation_declined':
      return <X size={size} />
    case 'portal_submitted':
      return <FileText size={size} />
    case 'medical_blocked':
      return <AlertCircle size={size} />
    case 'medical_cleared':
      return <Shield size={size} />
    default:
      return null
  }
}

function iconColor(action: AuditAction): string {
  switch (action) {
    case 'created':
    case 'submitted':
    case 'confirmed':
    case 'completed':
    case 'reservation_accepted':
    case 'medical_cleared':
      return 'var(--color-status-confirmed-icon, var(--color-success))'
    case 'cancelled':
    case 'expired':
    case 'reservation_declined':
    case 'medical_blocked':
      return 'var(--color-status-cancelled-icon, var(--color-destructive))'
    case 'edited':
    case 'portal_submitted':
      return 'var(--color-status-upcoming-icon, var(--color-status-upcoming))'
    default:
      return 'var(--color-text-secondary)'
  }
}

function actorLabel(entry: AuditEntry): string {
  if (entry.actorSlug === 'system') return 'System'
  return entry.actorSlug
}

// ── DiffExpander ───────────────────────────────────────────────────────────────

function DiffExpander({ diff }: { diff: string }) {
  const [open, setOpen] = useState(false)

  let parsed: Record<string, { old: unknown; new: unknown }> = {}
  try {
    parsed = JSON.parse(diff)
  } catch {
    return null
  }

  const entries = Object.entries(parsed)
  if (entries.length === 0) return null

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs transition-colors text-secondary min-h-[44px]"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {open ? 'Hide changes' : `${entries.length} field${entries.length > 1 ? 's' : ''} changed`}
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {entries.map(([field, change]) => (
            <div
              key={field}
              className="flex items-baseline gap-2 text-xs font-mono px-2 py-1 rounded text-secondary"
              style={{ background: 'var(--color-glass-bg)' }}
            >
              <span className="font-semibold text-primary" style={{ minWidth: '6rem' }}>
                {field}
              </span>
              <span style={{ color: 'var(--color-destructive)', textDecoration: 'line-through' }}>
                {String(change.old ?? '—')}
              </span>
              <span className="text-secondary">→</span>
              <span style={{ color: 'var(--color-success)' }}>
                {String(change.new ?? '—')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TimelineEntry ──────────────────────────────────────────────────────────────

function TimelineEntry({
  entry,
  isLast,
}: {
  entry: AuditEntry
  isLast: boolean
}) {
  const color = iconColor(entry.action)

  return (
    <div className="flex gap-3 relative">
      {/* Vertical connector line */}
      {!isLast && (
        <div
          className="absolute left-[15px] top-[28px] w-px"
          style={{
            bottom: '-8px',
            background: 'var(--color-glass-border)',
          }}
        />
      )}

      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10" /* design-ok */
        style={{
          background: 'var(--color-glass-bg-elevated)',
          border: '1px solid var(--color-glass-border)',
          color,
        }}
      >
        <ActionIcon action={entry.action} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <span
            className="text-sm font-medium text-primary"
          >
            {actionLabel(entry.action)}
          </span>
          <span
            className="text-xs flex-shrink-0 text-secondary"
          >
            {timeAgo(entry.timestamp)}
          </span>
        </div>
        <p className="text-xs mt-0.5 text-secondary">
          {actorLabel(entry)}
          {entry.note && <> · {entry.note}</>}
        </p>
        {entry.diff && <DiffExpander diff={entry.diff} />}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AuditTrailTable({ bookingId }: AuditTrailTableProps) {
  const entries = useQuery(api.bookingAuditLog.getAuditLog, {
    bookingId: bookingId as Id<'bookings'>,
  })

  if (entries === undefined) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-8 h-8 flex-shrink-0" shape="circle" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-secondary">
        No activity recorded yet.
      </p>
    )
  }

  return (
    <div>
      {(entries as AuditEntry[]).map((entry, idx) => (
        <TimelineEntry key={entry._id} entry={entry} isLast={idx === entries.length - 1} />
      ))}
    </div>
  )
}
