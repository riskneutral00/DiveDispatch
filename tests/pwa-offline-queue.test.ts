import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import {
  OfflineQueue,
  type QueuedMutation,
} from '../src/lib/pwa/offline-queue'

// Polyfill crypto.randomUUID for test environment
if (typeof globalThis.crypto === 'undefined') {
  let counter = 0
  globalThis.crypto = {
    randomUUID: () => `test-uuid-${++counter}`,
  } as Crypto
}

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

  it('generates an idempotencyKey for each enqueued mutation', () => {
    queue.enqueue('bookings:confirm', { id: '1' })
    const items = queue.getAll()
    expect(items[0].idempotencyKey).toBeTruthy()
    expect(typeof items[0].idempotencyKey).toBe('string')
    expect(items[0].idempotencyKey.length).toBeGreaterThan(0)
  })

  it('assigns unique idempotency keys to different mutations', () => {
    queue.enqueue('bookings:confirm', { id: '1' })
    queue.enqueue('bookings:confirm', { id: '2' })
    const items = queue.getAll()
    expect(items[0].idempotencyKey).not.toBe(items[1].idempotencyKey)
  })

  it('preserves idempotencyKey on failed items retained for retry', async () => {
    queue.enqueue('bookings:fail', { id: '1' })
    const originalKey = queue.getAll()[0].idempotencyKey

    const executor = vi.fn(async () => {
      throw new Error('Network error')
    })

    await queue.replay(executor)

    // Failed item stays in queue with same idempotency key
    const items = queue.getAll()
    expect(items).toHaveLength(1)
    expect(items[0].idempotencyKey).toBe(originalKey)
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

describe('OfflineQueue IndexedDB persistence', () => {
  const openQueues: OfflineQueue[] = []

  function trackQueue(q: OfflineQueue): OfflineQueue {
    openQueues.push(q)
    return q
  }

  afterEach(() => {
    // Close all open DB connections so deleteDatabase can proceed
    for (const q of openQueues) {
      q.close()
    }
    openQueues.length = 0
    indexedDB.deleteDatabase('offline-mutation-queue')
  })

  it('enqueue persists to IndexedDB and survives re-init', async () => {
    const queue1 = trackQueue(new OfflineQueue())
    await queue1.init()
    queue1.enqueue('bookings:confirm', { bookingId: 'abc' })

    // Wait for IndexedDB write to complete
    await new Promise((r) => setTimeout(r, 50))

    // Close first connection before opening second
    queue1.close()

    // Simulate page reload: create a new instance and hydrate from IndexedDB
    const queue2 = trackQueue(new OfflineQueue())
    await queue2.init()

    const items = queue2.getAll()
    expect(items).toHaveLength(1)
    expect(items[0].functionName).toBe('bookings:confirm')
    expect(items[0].args).toEqual({ bookingId: 'abc' })
  })

  it('successful replay removes entry from IndexedDB', async () => {
    const queue1 = trackQueue(new OfflineQueue())
    await queue1.init()
    queue1.enqueue('bookings:confirm', { bookingId: 'abc' })

    // Wait for IndexedDB write
    await new Promise((r) => setTimeout(r, 50))

    const executor = vi.fn(async () => {})
    await queue1.replay(executor)

    // Close first connection before opening second
    queue1.close()

    // New instance should see empty queue
    const queue2 = trackQueue(new OfflineQueue())
    await queue2.init()
    expect(queue2.getAll()).toEqual([])
    expect(queue2.size()).toBe(0)
  })

  it('failed replay keeps entry in IndexedDB', async () => {
    const queue1 = trackQueue(new OfflineQueue())
    await queue1.init()
    queue1.enqueue('bookings:fail', { bookingId: 'abc' })

    // Wait for IndexedDB write
    await new Promise((r) => setTimeout(r, 50))

    const executor = vi.fn(async () => {
      throw new Error('Network error')
    })
    await queue1.replay(executor)

    // Close first connection before opening second
    queue1.close()

    // New instance should still see the failed item
    const queue2 = trackQueue(new OfflineQueue())
    await queue2.init()
    expect(queue2.getAll()).toHaveLength(1)
    expect(queue2.getAll()[0].functionName).toBe('bookings:fail')
  })

  it('clear removes all entries from IndexedDB', async () => {
    const queue1 = trackQueue(new OfflineQueue())
    await queue1.init()
    queue1.enqueue('bookings:confirm', { id: '1' })
    queue1.enqueue('bookings:decline', { id: '2' })

    // Wait for IndexedDB writes
    await new Promise((r) => setTimeout(r, 50))

    await queue1.clear()

    // Close first connection before opening second
    queue1.close()

    // New instance should see empty queue
    const queue2 = trackQueue(new OfflineQueue())
    await queue2.init()
    expect(queue2.getAll()).toEqual([])
  })
})

describe('OfflineQueue Web Locks replay gate', () => {
  it('two concurrent replay calls each fire each mutation only once', async () => {
    // Polyfill Web Locks for test environment
    let lockHeld = false
    const lockQueue: Array<() => void> = []
    const originalLocks = navigator.locks

    Object.defineProperty(navigator, 'locks', {
      value: {
        request: async (_name: string, callback: () => Promise<unknown>) => {
          if (lockHeld) {
            // Queue the request and wait
            await new Promise<void>((resolve) => {
              lockQueue.push(resolve)
            })
          }
          lockHeld = true
          try {
            return await callback()
          } finally {
            lockHeld = false
            const next = lockQueue.shift()
            if (next) next()
          }
        },
      },
      configurable: true,
    })

    const queue = new OfflineQueue()
    queue.enqueue('bookings:confirm', { id: '1' })
    queue.enqueue('bookings:confirm', { id: '2' })

    const executedIds: string[] = []
    const executor = vi.fn(async (mutation: QueuedMutation) => {
      executedIds.push(mutation.args.id as string)
    })

    // Fire two replays concurrently
    const [result1, result2] = await Promise.all([
      queue.replay(executor),
      queue.replay(executor),
    ])

    // First replay should process both, second should find queue empty
    expect(result1.succeeded + result2.succeeded).toBe(2)
    expect(executedIds).toEqual(['1', '2'])
    expect(queue.size()).toBe(0)

    // Restore
    Object.defineProperty(navigator, 'locks', {
      value: originalLocks,
      configurable: true,
    })
  })
})

describe('OfflineQueue same-tab replay guard', () => {
  it('second concurrent replay no-ops when first is still running', async () => {
    // Disable Web Locks so we test the in-method guard, not cross-tab lock
    const originalLocks = navigator.locks
    Object.defineProperty(navigator, 'locks', {
      value: undefined,
      configurable: true,
    })

    const queue = new OfflineQueue()
    queue.enqueue('bookings:confirm', { id: '1' })
    queue.enqueue('bookings:confirm', { id: '2' })

    const executedIds: string[] = []
    let resolveFirstMutation: (() => void) | null = null

    // Executor that blocks on the first call so we can fire a second replay
    const executor = vi.fn(async (mutation: QueuedMutation) => {
      if (!resolveFirstMutation) {
        await new Promise<void>((resolve) => {
          resolveFirstMutation = resolve
        })
      }
      executedIds.push(mutation.args.id as string)
    })

    // Start first replay (will block on first mutation)
    const replay1Promise = queue.replay(executor)

    // Wait for executor to be called (it's now blocking)
    await vi.waitFor(() => {
      expect(resolveFirstMutation).not.toBeNull()
    })

    // Fire second replay while first is still running
    const result2 = await queue.replay(executor)

    // Second replay should no-op
    expect(result2.succeeded).toBe(0)
    expect(result2.failed).toBe(0)
    expect(result2.errors).toEqual([])

    // Unblock the first replay
    resolveFirstMutation!()
    const result1 = await replay1Promise

    // First replay should have processed both mutations
    expect(result1.succeeded).toBe(2)
    expect(result1.failed).toBe(0)
    expect(executedIds).toEqual(['1', '2'])
    expect(queue.size()).toBe(0)

    // Executor called exactly twice (once per mutation, no double-fire)
    expect(executor).toHaveBeenCalledTimes(2)

    Object.defineProperty(navigator, 'locks', {
      value: originalLocks,
      configurable: true,
    })
  })

  it('replay works again after first replay completes', async () => {
    const originalLocks = navigator.locks
    Object.defineProperty(navigator, 'locks', {
      value: undefined,
      configurable: true,
    })

    const queue = new OfflineQueue()
    queue.enqueue('bookings:confirm', { id: '1' })

    const executor = vi.fn(async () => {})

    // First replay
    const result1 = await queue.replay(executor)
    expect(result1.succeeded).toBe(1)

    // Enqueue more and replay again -- should work, not stay locked
    queue.enqueue('bookings:confirm', { id: '2' })
    const result2 = await queue.replay(executor)
    expect(result2.succeeded).toBe(1)
    expect(queue.size()).toBe(0)

    Object.defineProperty(navigator, 'locks', {
      value: originalLocks,
      configurable: true,
    })
  })

  it('replaying flag resets even when executor throws for all items', async () => {
    const originalLocks = navigator.locks
    Object.defineProperty(navigator, 'locks', {
      value: undefined,
      configurable: true,
    })

    const queue = new OfflineQueue()
    queue.enqueue('bookings:fail', { id: '1' })

    const failExecutor = vi.fn(async () => {
      throw new Error('Network error')
    })

    // First replay -- all items fail
    const result1 = await queue.replay(failExecutor)
    expect(result1.failed).toBe(1)

    // Second replay should still work (flag was reset in finally block)
    const succeedExecutor = vi.fn(async () => {})
    const result2 = await queue.replay(succeedExecutor)
    expect(result2.succeeded).toBe(1)
    expect(queue.size()).toBe(0)

    Object.defineProperty(navigator, 'locks', {
      value: originalLocks,
      configurable: true,
    })
  })

  it('two simultaneous replay calls fire each mutation exactly once', async () => {
    const originalLocks = navigator.locks
    Object.defineProperty(navigator, 'locks', {
      value: undefined,
      configurable: true,
    })

    const queue = new OfflineQueue()
    queue.enqueue('bookings:confirm', { id: '1' })
    queue.enqueue('bookings:decline', { id: '2' })
    queue.enqueue('bookings:confirm', { id: '3' })

    const callCount = new Map<string, number>()
    let resolveBlock: (() => void) | null = null

    const executor = vi.fn(async (mutation: QueuedMutation) => {
      const id = mutation.args.id as string
      // Block on first call to create timing window for concurrent replay
      if (!resolveBlock) {
        await new Promise<void>((resolve) => {
          resolveBlock = resolve
        })
      }
      callCount.set(id, (callCount.get(id) ?? 0) + 1)
    })

    const p1 = queue.replay(executor)

    // Wait until first executor call is blocking
    await vi.waitFor(() => {
      expect(resolveBlock).not.toBeNull()
    })

    // Fire second replay concurrently
    const p2 = queue.replay(executor)

    // Unblock
    resolveBlock!()

    const [r1, r2] = await Promise.all([p1, p2])

    // Total: exactly 3 mutations executed, no double-fires
    expect(r1.succeeded + r2.succeeded).toBe(3)
    expect(r2.succeeded).toBe(0) // second was no-op

    // Each mutation called exactly once
    expect(callCount.get('1')).toBe(1)
    expect(callCount.get('2')).toBe(1)
    expect(callCount.get('3')).toBe(1)

    Object.defineProperty(navigator, 'locks', {
      value: originalLocks,
      configurable: true,
    })
  })
})

describe('OfflineQueue in-memory fallback', () => {
  it('works without IndexedDB when init is not called', () => {
    const queue = new OfflineQueue()
    queue.enqueue('bookings:confirm', { id: '1' })
    expect(queue.size()).toBe(1)
    expect(queue.getAll()[0].functionName).toBe('bookings:confirm')
  })
})
