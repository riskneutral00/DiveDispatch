export type SeverityTier = 'action' | 'attention' | 'info'

export const TIER_COLOR: Record<SeverityTier, string> = {
  action: 'var(--color-status-urgent)',
  attention: 'var(--color-status-warning)',
  info: 'var(--color-status-success)',
}

export const READ_COLOR = 'var(--color-text-secondary)'

export type IconName =
  | 'AlertTriangle'
  | 'Ban'
  | 'Bell'
  | 'CheckCircle'
  | 'Clock'
  | 'ShieldCheck'
  | 'RotateCcw'
  | 'UserCheck'
  | 'UserX'
  | 'UsersRound'
  | 'XCircle'
  | 'FileText'
  | 'ArrowRightLeft'

export interface NotificationTypeConfig {
  icon: IconName
  tier: SeverityTier
}

import type { NotificationType } from '@/lib/constants/statuses'

export const NOTIFICATION_CONFIG = {
  medical_hard_block: { icon: 'AlertTriangle', tier: 'action' },
  no_backup_available: { icon: 'Ban', tier: 'action' },
  hold_declined: { icon: 'XCircle', tier: 'action' },
  min_pax_not_met: { icon: 'UsersRound', tier: 'action' },

  noshow_marked: { icon: 'UserX', tier: 'attention' },
  noshow_reverted: { icon: 'RotateCcw', tier: 'attention' },
  booking_updated: { icon: 'FileText', tier: 'attention' },
  booking_referred: { icon: 'ArrowRightLeft', tier: 'attention' },
  booking_cancelled: { icon: 'Ban', tier: 'attention' },
  physician_clearance_submitted: { icon: 'FileText', tier: 'attention' },

  hold_placed: { icon: 'Clock', tier: 'info' },
  medical_cleared: { icon: 'ShieldCheck', tier: 'info' },
  portal_complete: { icon: 'CheckCircle', tier: 'info' },
  booking_confirmed: { icon: 'CheckCircle', tier: 'info' },
  reservation_accepted: { icon: 'UserCheck', tier: 'info' },
} satisfies Record<NotificationType, NotificationTypeConfig>

const FALLBACK_CONFIG: NotificationTypeConfig = { icon: 'Bell', tier: 'info' }

export function getNotificationStyle(type: string, isUnread: boolean): { icon: IconName; color: string } {
  const isKnownType = type in NOTIFICATION_CONFIG
  const config = isKnownType
    ? NOTIFICATION_CONFIG[type as NotificationType]
    : FALLBACK_CONFIG

  let color: string
  if (!isUnread) {
    color = READ_COLOR
  } else if (!isKnownType) {
    color = READ_COLOR
  } else {
    color = TIER_COLOR[config.tier]
  }

  return { icon: config.icon, color }
}
