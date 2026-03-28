/**
 * Notification icon + severity tier configuration.
 *
 * Three tiers:
 *   - action:  urgent items requiring immediate response  (--color-status-urgent, red)
 *   - attention: notable events worth reviewing           (--color-status-warning, amber)
 *   - info:    success / informational confirmations       (--color-status-success, green)
 *
 * Read notifications always use --color-text-secondary regardless of tier.
 */

// ── Severity tiers ──────────────────────────────────────────────────────────

export type SeverityTier = 'action' | 'attention' | 'info'

export const TIER_COLOR: Record<SeverityTier, string> = {
  action: 'var(--color-status-urgent)',
  attention: 'var(--color-status-warning)',
  info: 'var(--color-status-success)',
}

export const READ_COLOR = 'var(--color-text-secondary)'

// ── Icon names ──────────────────────────────────────────────────────────────
// Using string identifiers to decouple from React/lucide imports.
// The component maps these to actual icon components.

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

// ── Notification type config ────────────────────────────────────────────────

export interface NotificationTypeConfig {
  icon: IconName
  tier: SeverityTier
}

import type { NotificationType } from '../../../convex/shared/statuses'

/**
 * All 13 notification types from the schema, each with an icon and severity tier.
 * No hold_accepted -- it does not exist in the schema.
 */
export const NOTIFICATION_CONFIG = {
  // Action Required (urgent / red)
  medical_hard_block: { icon: 'AlertTriangle', tier: 'action' },
  no_backup_available: { icon: 'Ban', tier: 'action' },
  hold_declined: { icon: 'XCircle', tier: 'action' },
  min_pax_not_met: { icon: 'UsersRound', tier: 'action' },

  // Attention (warning / amber)
  noshow_marked: { icon: 'UserX', tier: 'attention' },
  noshow_reverted: { icon: 'RotateCcw', tier: 'attention' },
  booking_updated: { icon: 'FileText', tier: 'attention' },
  booking_referred: { icon: 'ArrowRightLeft', tier: 'attention' },
  booking_cancelled: { icon: 'Ban', tier: 'attention' },
  physician_clearance_submitted: { icon: 'FileText', tier: 'attention' },

  // Success / Info (green)
  hold_placed: { icon: 'Clock', tier: 'info' },
  medical_cleared: { icon: 'ShieldCheck', tier: 'info' },
  portal_complete: { icon: 'CheckCircle', tier: 'info' },
} satisfies Record<NotificationType, NotificationTypeConfig>

const FALLBACK_CONFIG: NotificationTypeConfig = { icon: 'Bell', tier: 'info' }

/**
 * Returns the icon name and CSS color variable for a notification.
 *
 * - Unread notifications get the tier color.
 * - Read notifications always get --color-text-secondary.
 * - Unknown types fall back to Bell + --color-text-secondary.
 */
export function getNotificationStyle(type: string, isUnread: boolean): { icon: IconName; color: string } {
  const config = NOTIFICATION_CONFIG[type] ?? FALLBACK_CONFIG
  const isKnownType = type in NOTIFICATION_CONFIG

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
