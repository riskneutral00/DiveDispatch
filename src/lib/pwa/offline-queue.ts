export interface QueuedMutation {
  id: string
  functionName: string
  args: Record<string, unknown>
  timestamp: number
  idempotencyKey: string
}

export interface ReplayResult {
  succeeded: number
  failed: number
  errors: Array<{ mutation: QueuedMutation; error: unknown }>
}

const DB_NAME = 'offline-mutation-queue'
const STORE_NAME = 'mutations'
const DB_VERSION = 1

let nextId = 0

function generateId(): string {
  return `offline-${Date.now()}-${nextId++}`
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'idempotencyKey' })
        }
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        resolve(null)
      }
    } catch {
      resolve(null)
    }
  })
}

function readAllFromStore(db: IDBDatabase): Promise<QueuedMutation[]> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        const items = request.result as QueuedMutation[]
        items.sort((a, b) => a.timestamp - b.timestamp)
        resolve(items)
      }

      request.onerror = () => {
        resolve([])
      }
    } catch {
      resolve([])
    }
  })
}

function writeToStore(db: IDBDatabase, mutation: QueuedMutation): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put(mutation)

      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

function deleteFromStore(db: IDBDatabase, idempotencyKey: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.delete(idempotencyKey)

      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

function clearStore(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.clear()

      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export class OfflineQueue {
  private queue: QueuedMutation[] = []
  private db: IDBDatabase | null = null
  private replaying = false

  async init(): Promise<void> {
    this.db = await openDatabase()
    if (this.db) {
      const persisted = await readAllFromStore(this.db)
      this.queue = persisted
    }
  }

  enqueue(functionName: string, args: Record<string, unknown>): void {
    const mutation: QueuedMutation = {
      id: generateId(),
      functionName,
      args,
      timestamp: Date.now(),
      idempotencyKey: crypto.randomUUID(),
    }
    this.queue.push(mutation)

    if (this.db) {
      writeToStore(this.db, mutation)
    }
  }

  dequeue(): QueuedMutation | undefined {
    const mutation = this.queue.shift()

    if (this.db && mutation) {
      deleteFromStore(this.db, mutation.idempotencyKey)
    }

    return mutation
  }

  getAll(): ReadonlyArray<QueuedMutation> {
    return [...this.queue]
  }

  size(): number {
    return this.queue.length
  }

  async clear(): Promise<void> {
    this.queue = []
    if (this.db) {
      await clearStore(this.db)
    }
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  async replay(
    executor: (mutation: QueuedMutation) => Promise<void>
  ): Promise<ReplayResult> {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request('offline-queue-replay', () =>
        this.replayInternal(executor)
      )
    }
    return this.replayInternal(executor)
  }

  private async replayInternal(
    executor: (mutation: QueuedMutation) => Promise<void>
  ): Promise<ReplayResult> {
    if (this.replaying) {
      return { succeeded: 0, failed: 0, errors: [] }
    }

    this.replaying = true
    try {
      const items = [...this.queue]
      const failedItems: QueuedMutation[] = []
      const errors: ReplayResult['errors'] = []
      let succeeded = 0

      for (const mutation of items) {
        try {
          await executor(mutation)
          succeeded++

          if (this.db) {
            await deleteFromStore(this.db, mutation.idempotencyKey)
          }
        } catch (error) {
          failedItems.push(mutation)
          errors.push({ mutation, error })
        }
      }

      this.queue = failedItems

      return { succeeded, failed: failedItems.length, errors }
    } finally {
      this.replaying = false
    }
  }
}
