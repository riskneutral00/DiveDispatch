import { describe, it, expect } from 'vitest'
import type { NotificationDoc as NotificationDocFromLib } from '../notifications'
import type { NotificationDoc as NotificationDocFromComponent } from '@/components/notifications/notification-item'

describe('NotificationDoc type location', () => {
  it('canonical type from lib/types/notifications has all required fields', () => {
    const doc: NotificationDocFromLib = {
      _id: 'n-1',
      type: 'booking_accepted',
      message: 'Booking accepted',
      createdAt: 1000,
    }
    expect(doc._id).toBe('n-1')
    expect(doc.type).toBe('booking_accepted')
    expect(doc.message).toBe('Booking accepted')
    expect(doc.createdAt).toBe(1000)
    expect(doc.readAt).toBeUndefined()
  })

  it('re-exported type from notification-item is structurally identical', () => {
    const doc: NotificationDocFromComponent = {
      _id: 'n-2',
      type: 'resource_declined',
      message: 'Resource declined',
      createdAt: 2000,
      readAt: 3000,
    }
    const canonical: NotificationDocFromLib = doc
    expect(canonical._id).toBe('n-2')
    expect(canonical.readAt).toBe(3000)
  })

  it('readAt is optional on both type paths', () => {
    const fromLib: NotificationDocFromLib = {
      _id: 'n-3',
      type: 'test',
      message: 'test',
      createdAt: 1000,
    }
    const fromComponent: NotificationDocFromComponent = {
      _id: 'n-4',
      type: 'test',
      message: 'test',
      createdAt: 1000,
    }
    expect(fromLib.readAt).toBeUndefined()
    expect(fromComponent.readAt).toBeUndefined()
  })
})
