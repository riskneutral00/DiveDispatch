/**
 * Offline mutation queue for PWA.
 *
 * Queues mutations made while offline and replays them in FIFO order
 * when connectivity returns. Failed mutations remain in queue for retry.
 */

export interface QueuedMutation {
  id: string
  functionName: string
  args: Record<string, unknown>
  timestamp: number
}

export interface ReplayResult {
  succeeded: number
  failed: number
  errors: Array<{ mutation: QueuedMutation; error: unknown }>
}

let nextId = 0

function generateId(): string {
  return `offline-${Date.now()}-${nextId++}`
}

export class OfflineQueue {
  private queue: QueuedMutation[] = []

  enqueue(functionName: string, args: Record<string, unknown>): void {
    this.queue.push({
      id: generateId(),
      functionName,
      args,
      timestamp: Date.now(),
    })
  }

  dequeue(): QueuedMutation | undefined {
    return this.queue.shift()
  }

  getAll(): ReadonlyArray<QueuedMutation> {
    return [...this.queue]
  }

  size(): number {
    return this.queue.length
  }

  clear(): void {
    this.queue = []
  }

  /**
   * Replay all queued mutations through the provided executor.
   * Successful mutations are removed from queue. Failed ones remain for retry.
   */
  async replay(
    executor: (mutation: QueuedMutation) => Promise<void>
  ): Promise<ReplayResult> {
    const items = [...this.queue]
    const failedItems: QueuedMutation[] = []
    const errors: ReplayResult['errors'] = []
    let succeeded = 0

    for (const mutation of items) {
      try {
        await executor(mutation)
        succeeded++
      } catch (error) {
        failedItems.push(mutation)
        errors.push({ mutation, error })
      }
    }

    // Replace queue with only failed items
    this.queue = failedItems

    return { succeeded, failed: failedItems.length, errors }
  }
}
