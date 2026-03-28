import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  OfflineQueue,
  type QueuedMutation,
} from '../src/lib/pwa/offline-queue'

describe('OfflineQueue', () => {
  let queue: OfflineQueue

  beforeEach(() => {
    queue = new OfflineQueue()
  })

  it('starts empty', () => {
    expect(queue.getAll()).toEqual([])
    expect(queue.size()).toBe(0)
  })

  it('enqueues a mutation with timestamp', () => {
    const before = Date.now()
    queue.enqueue('bookings:confirm', { bookingId: 'abc123' })
    const after = Date.now()

    const items = queue.getAll()
    expect(items).toHaveLength(1)
    expect(items[0].functionName).toBe('bookings:confirm')
    expect(items[0].args).toEqual({ bookingId: 'abc123' })
    expect(items[0].timestamp).toBeGreaterThanOrEqual(before)
    expect(items[0].timestamp).toBeLessThanOrEqual(after)
  })

  it('maintains FIFO order', () => {
    queue.enqueue('bookings:confirm', { id: '1' })
    queue.enqueue('bookings:decline', { id: '2' })
    queue.enqueue('bookings:confirm', { id: '3' })

    const names = queue.getAll().map((m) => m.args.id)
    expect(names).toEqual(['1', '2', '3'])
  })

  it('dequeues items in order', () => {
    queue.enqueue('bookings:confirm', { id: '1' })
    queue.enqueue('bookings:decline', { id: '2' })

    const first = queue.dequeue()
    expect(first?.args.id).toBe('1')
    expect(queue.size()).toBe(1)

    const second = queue.dequeue()
    expect(second?.args.id).toBe('2')
    expect(queue.size()).toBe(0)
  })

  it('returns undefined when dequeuing from empty queue', () => {
    expect(queue.dequeue()).toBeUndefined()
  })

  it('clears all items', () => {
    queue.enqueue('bookings:confirm', { id: '1' })
    queue.enqueue('bookings:decline', { id: '2' })
    queue.clear()
    expect(queue.size()).toBe(0)
    expect(queue.getAll()).toEqual([])
  })

  it('assigns unique IDs to each queued mutation', () => {
    queue.enqueue('bookings:confirm', { id: '1' })
    queue.enqueue('bookings:confirm', { id: '2' })
    const items = queue.getAll()
    expect(items[0].id).not.toBe(items[1].id)
  })
})

describe('OfflineQueue.replay', () => {
  it('calls executor for each queued mutation in order', async () => {
    const queue = new OfflineQueue()
    queue.enqueue('bookings:confirm', { id: '1' })
    queue.enqueue('bookings:decline', { id: '2' })

    const executed: string[] = []
    const executor = vi.fn(async (mutation: QueuedMutation) => {
      executed.push(mutation.args.id as string)
    })

    const results = await queue.replay(executor)

    expect(executed).toEqual(['1', '2'])
    expect(results.succeeded).toBe(2)
    expect(results.failed).toBe(0)
    expect(queue.size()).toBe(0)
  })

  it('continues replaying after individual failures and reports them', async () => {
    const queue = new OfflineQueue()
    queue.enqueue('bookings:confirm', { id: '1' })
    queue.enqueue('bookings:fail', { id: '2' })
    queue.enqueue('bookings:confirm', { id: '3' })

    const executor = vi.fn(async (mutation: QueuedMutation) => {
      if (mutation.functionName === 'bookings:fail') {
        throw new Error('Network error')
      }
    })

    const results = await queue.replay(executor)

    expect(results.succeeded).toBe(2)
    expect(results.failed).toBe(1)
    expect(results.errors).toHaveLength(1)
    expect(results.errors[0].mutation.functionName).toBe('bookings:fail')
    // Failed items remain in queue for retry
    expect(queue.size()).toBe(1)
    expect(queue.getAll()[0].functionName).toBe('bookings:fail')
  })
})
