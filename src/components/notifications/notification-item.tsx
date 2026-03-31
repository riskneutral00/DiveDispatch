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
import { timeAgo } from '@/lib/utils/time-ago'

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

// Static component — declared outside render to preserve reference identity.
function NotificationIcon({ type, isUnread }: { type: string; isUnread: boolean }) {
  const { icon, color } = getNotificationStyle(type, isUnread)
  const Icon = ICON_MAP[icon] ?? Bell
  return <Icon size={16} style={{ color }} />
}

export type { NotificationDoc } from '@/lib/types/notifications'
import type { NotificationDoc } from '@/lib/types/notifications'

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
            className="text-sm leading-snug text-primary"
            style={{ fontWeight: isUnread ? 600 : 400 }}
          >
            {notification.message}
          </p>
          <p className="text-xs mt-0.5 text-secondary">
            {timeAgo(notification.createdAt)}
          </p>
        </div>

        {isUnread && (
          <div
            className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full"
            style={{ background: 'var(--color-primary)' }}
            aria-hidden="true"
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
        <Trash2 className="text-secondary" size={14} />
      </button>
    </div>
  )
}
