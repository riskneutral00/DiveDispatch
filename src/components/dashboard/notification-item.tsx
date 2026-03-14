'use client'

import {
  AlertTriangle,
  Ban,
  Bell,
  CheckCircle,
  Clock,
  UserCheck,
  XCircle,
} from 'lucide-react'

const TYPE_ICON: Record<string, React.ElementType> = {
  hold_placed: Clock,
  hold_accepted: CheckCircle,
  hold_declined: XCircle,
  booking_cancelled: Ban,
  portal_complete: UserCheck,
  medical_hard_block: AlertTriangle,
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// Static component — declared outside render to preserve reference identity.
function NotificationIcon({ type, isUnread }: { type: string; isUnread: boolean }) {
  if (type === 'hold_placed') return <Clock size={16} style={{ color: isUnread ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
  if (type === 'hold_accepted') return <CheckCircle size={16} style={{ color: isUnread ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
  if (type === 'hold_declined') return <XCircle size={16} style={{ color: isUnread ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
  if (type === 'booking_cancelled') return <Ban size={16} style={{ color: isUnread ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
  if (type === 'portal_complete') return <UserCheck size={16} style={{ color: isUnread ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
  if (type === 'medical_hard_block') return <AlertTriangle size={16} style={{ color: isUnread ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
  return <Bell size={16} style={{ color: isUnread ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
}

export interface NotificationDoc {
  _id: string
  type: string
  message: string
  createdAt: number
  readAt?: number
}

// Keep TYPE_ICON exported for tests / storybook — not used in render path.
export { TYPE_ICON }

interface NotificationItemProps {
  notification: NotificationDoc
  onClick: (id: string) => void
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const isUnread = notification.readAt === undefined

  return (
    <button
      onClick={() => onClick(notification._id)}
      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
      style={{
        background: isUnread ? 'var(--color-surface-elevated)' : 'transparent',
        borderBottom: '1px solid var(--color-glass-border)',
      }}
    >
      <div className="flex-shrink-0 mt-0.5">
        <NotificationIcon type={notification.type} isUnread={isUnread} />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="text-sm leading-snug"
          style={{
            color: 'var(--color-text-primary)',
            fontWeight: isUnread ? 600 : 400,
          }}
        >
          {notification.message}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {timeAgo(notification.createdAt)}
        </p>
      </div>

      {isUnread && (
        <div
          className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full"
          style={{ background: 'var(--color-primary)' }}
          aria-label="Unread"
        />
      )}
    </button>
  )
}
