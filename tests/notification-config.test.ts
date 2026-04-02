import { describe, it, expect } from 'vitest'
import type { NotificationType } from '../convex/shared/statuses'
import {
  NOTIFICATION_CONFIG,
  TIER_COLOR,
  READ_COLOR,
  getNotificationStyle,
} from '../src/lib/notifications/notification-config'

// ── All 14 schema types ────────────────────────────────────────────────────

const ALL_SCHEMA_TYPES = [
  'hold_placed',
  'hold_declined',
  'booking_cancelled',
  'booking_updated',
  'booking_referred',
  'booking_confirmed',
  'medical_hard_block',
  'medical_cleared',
  'physician_clearance_submitted',
  'no_backup_available',
  'min_pax_not_met',
  'noshow_marked',
  'noshow_reverted',
  'portal_complete',
] as const

// ── NOTIFICATION_CONFIG completeness ───────────────────────────────────────

describe('NOTIFICATION_CONFIG', () => {
  it('has an entry for all 14 schema notification types', () => {
    for (const type of ALL_SCHEMA_TYPES) {
      expect(NOTIFICATION_CONFIG[type], `missing config for "${type}"`).toHaveProperty('tier')
    }
  })

  it('has exactly 14 entries (no extras)', () => {
    expect(Object.keys(NOTIFICATION_CONFIG)).toHaveLength(14)
  })

  it('does not contain hold_accepted (phantom type)', () => {
    expect(NOTIFICATION_CONFIG).not.toHaveProperty('hold_accepted')
  })
})

// ── Tier assignments ───────────────────────────────────────────────────────

describe('tier assignments', () => {
  const ACTION_TYPES = ['medical_hard_block', 'no_backup_available', 'hold_declined', 'min_pax_not_met']
  const ATTENTION_TYPES = [
    'noshow_marked',
    'noshow_reverted',
    'booking_updated',
    'booking_referred',
    'booking_cancelled',
    'physician_clearance_submitted',
  ]
  const INFO_TYPES = ['hold_placed', 'medical_cleared', 'portal_complete', 'booking_confirmed']

  it.each(ACTION_TYPES)('"%s" is tier action', (type) => {
    expect(NOTIFICATION_CONFIG[type as NotificationType].tier).toBe('action')
  })

  it.each(ATTENTION_TYPES)('"%s" is tier attention', (type) => {
    expect(NOTIFICATION_CONFIG[type as NotificationType].tier).toBe('attention')
  })

  it.each(INFO_TYPES)('"%s" is tier info', (type) => {
    expect(NOTIFICATION_CONFIG[type as NotificationType].tier).toBe('info')
  })
})

// ── getNotificationStyle ───────────────────────────────────────────────────

describe('getNotificationStyle', () => {
  describe('unread notifications use tier color', () => {
    it('action tier returns --color-status-urgent', () => {
      const result = getNotificationStyle('medical_hard_block', true)
      expect(result.color).toBe(TIER_COLOR.action)
    })

    it('attention tier returns --color-status-warning', () => {
      const result = getNotificationStyle('booking_updated', true)
      expect(result.color).toBe(TIER_COLOR.attention)
    })

    it('info tier returns --color-status-success', () => {
      const result = getNotificationStyle('hold_placed', true)
      expect(result.color).toBe(TIER_COLOR.info)
    })
  })

  describe('read notifications always use --color-text-secondary', () => {
    it('action tier when read', () => {
      const result = getNotificationStyle('medical_hard_block', false)
      expect(result.color).toBe(READ_COLOR)
    })

    it('attention tier when read', () => {
      const result = getNotificationStyle('booking_updated', false)
      expect(result.color).toBe(READ_COLOR)
    })

    it('info tier when read', () => {
      const result = getNotificationStyle('hold_placed', false)
      expect(result.color).toBe(READ_COLOR)
    })
  })

  describe('icon mapping', () => {
    it('hold_placed maps to Clock', () => {
      expect(getNotificationStyle('hold_placed', true).icon).toBe('Clock')
    })

    it('medical_cleared maps to ShieldCheck', () => {
      expect(getNotificationStyle('medical_cleared', true).icon).toBe('ShieldCheck')
    })

    it('portal_complete maps to CheckCircle', () => {
      expect(getNotificationStyle('portal_complete', true).icon).toBe('CheckCircle')
    })
  })

  describe('fallback for unknown types', () => {
    it('returns Bell icon', () => {
      const result = getNotificationStyle('some_unknown_type', true)
      expect(result.icon).toBe('Bell')
    })

    it('returns --color-text-secondary even when unread', () => {
      const result = getNotificationStyle('some_unknown_type', true)
      expect(result.color).toBe(READ_COLOR)
    })

    it('returns --color-text-secondary when read', () => {
      const result = getNotificationStyle('some_unknown_type', false)
      expect(result.color).toBe(READ_COLOR)
    })
  })
})
