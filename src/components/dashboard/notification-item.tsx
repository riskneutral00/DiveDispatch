'use client'

import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  Bell,
  CheckCircle,
  Clock,
  FileText,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  UsersRound,
  XCircle,
} from 'lucide-react'
import type { IconName } from '@/lib/notifications/notification-config'
import { getNotificationStyle } from '@/lib/notifications/notification-config'

const ICON_MAP: Record<IconName, React.ElementType> = {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  Bell,
  CheckCircle,
  Clock,
  FileText,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  UserX,
  UsersRound,
  XCircle,
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
  const { icon, color } = getNotificationStyle(type, isUnread)
  const Icon = ICON_MAP[icon] ?? Bell
  return <Icon size={16} style={{ color }} />
}

export interface NotificationDoc {
  _id: string
  type: string
  message: string
  createdAt: number
  readAt?: number
}

interface NotificationItemProps {
  notification: NotificationDoc
  onClick: (id: string) => void
  onDelete: (id: string) => void
}

export function NotificationItem({ notification, onClick, onDelete }: NotificationItemProps) {
  const isUnread = notification.readAt === undefined

  return (
    <div
      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
      style={{
        background: isUnread ? 'var(--color-surface-elevated)' : 'transparent',
        borderBottom: '1px solid var(--color-glass-border)',
      }}
    >
      <button
        onClick={() => onClick(notification._id)}
        className="flex items-start gap-3 flex-1 min-w-0"
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

      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(notification._id)
        }}
        className="flex-shrink-0 mt-0.5 p-1 rounded transition-opacity opacity-40 hover:opacity-100"
        aria-label="Delete notification"
      >
        <Trash2 size={14} style={{ color: 'var(--color-text-secondary)' }} />
      </button>
    </div>
  )
}
