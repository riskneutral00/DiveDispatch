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
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { AuditAction } from '../../../convex/bookingAuditLog'
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

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

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
      return 'var(--color-status-confirmed-icon, var(--color-success, #22c55e))'
    case 'cancelled':
    case 'expired':
    case 'reservation_declined':
    case 'medical_blocked':
      return 'var(--color-status-cancelled-icon, var(--color-destructive, #ef4444))'
    case 'edited':
    case 'portal_submitted':
      return 'var(--color-status-upcoming-icon, var(--color-info, #3b82f6))'
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
        className="flex items-center gap-1 text-xs transition-colors"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {open ? 'Hide changes' : `${entries.length} field${entries.length > 1 ? 's' : ''} changed`}
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {entries.map(([field, change]) => (
            <div
              key={field}
              className="flex items-baseline gap-2 text-xs font-mono px-2 py-1 rounded"
              style={{ background: 'var(--color-glass-bg)', color: 'var(--color-text-secondary)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--color-text-primary)', minWidth: '6rem' }}>
                {field}
              </span>
              <span style={{ color: 'var(--color-destructive)', textDecoration: 'line-through' }}>
                {String(change.old ?? '—')}
              </span>
              <span style={{ color: 'var(--color-text-secondary)' }}>→</span>
              <span style={{ color: 'var(--color-success, #22c55e)' }}>
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

      {/* Icon dot */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10"
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
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {actionLabel(entry.action)}
          </span>
          <span
            className="text-xs flex-shrink-0"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {timeAgo(entry.timestamp)}
          </span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
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
          <div key={i} className="flex gap-3 animate-pulse">
            <div
              className="w-8 h-8 rounded-full flex-shrink-0"
              style={{ background: 'var(--color-glass-border)' }}
            />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 rounded w-1/3" style={{ background: 'var(--color-glass-border)' }} />
              <div className="h-2 rounded w-1/4" style={{ background: 'var(--color-glass-border)' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
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
