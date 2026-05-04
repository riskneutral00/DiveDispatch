import type { GenericTableInfo, GenericDatabaseReader, GenericDatabaseWriter, GenericDataModel, QueryInitializer } from 'convex/server'
import type { GenericId, Value } from 'convex/values'
import type { DatabaseReader, DatabaseWriter } from '../_generated/server'

type AnyDbReader = GenericDatabaseReader<GenericDataModel>

type AnyDbWriter = GenericDatabaseWriter<GenericDataModel>

export function queryAllDynamicTable(
  db: DatabaseReader,
  table: string,
): QueryInitializer<GenericTableInfo> {
  return (db as unknown as AnyDbReader).query(table)
}

interface ChainableQueryLike {
  withIndex(name: string, range: unknown): ChainableQueryLike
  filter(predicate: unknown): ChainableQueryLike
  order(direction: 'asc' | 'desc'): ChainableQueryLike
  collect(): Promise<unknown[]>
  unique(): Promise<unknown>
  first(): Promise<unknown>
  take(n: number): Promise<unknown[]>
}

interface FilterBuilder {
  eq(a: unknown, b: unknown): unknown
  field(name: string): unknown
}

const ARCHIVED_FILTER_TAG = Symbol('archivedAtFilter')

function archivedFilterPredicate(q: FilterBuilder): unknown {
  return q.eq(q.field('archivedAt'), undefined)
}

function applyArchivedFilter(q: ChainableQueryLike): ChainableQueryLike {
  return q.filter(archivedFilterPredicate as unknown)
}

function wrapWithDeferredFilter<T extends ChainableQueryLike>(underlying: T): T {
  const proxy = new Proxy(underlying as unknown as object, {
    get(target, prop) {
      if (prop === ARCHIVED_FILTER_TAG) return true
      const value = Reflect.get(target, prop)
      if (typeof value !== 'function') return value

      if (prop === 'collect' || prop === 'unique' || prop === 'first' || prop === 'take') {
        return function (...args: unknown[]) {
          const filtered = applyArchivedFilter(target as unknown as ChainableQueryLike)
          return (filtered as unknown as Record<string, (...a: unknown[]) => unknown>)[
            prop as string
          ](...args)
        }
      }

      if (prop === 'withIndex' || prop === 'filter' || prop === 'order') {
        return function (...args: unknown[]) {
          const next = (value as (...a: unknown[]) => ChainableQueryLike).apply(target, args)
          return wrapWithDeferredFilter(next)
        }
      }

      return value.bind(target)
    },
  })
  return proxy as T
}

export function queryActiveDynamicTable(
  db: DatabaseReader,
  table: string,
): QueryInitializer<GenericTableInfo> {
  const base = (db as unknown as AnyDbReader).query(table)
  return wrapWithDeferredFilter(base as unknown as ChainableQueryLike) as unknown as QueryInitializer<GenericTableInfo>
}

export function queryDynamicTable(
  db: DatabaseReader,
  table: string,
): QueryInitializer<GenericTableInfo> {
  return queryAllDynamicTable(db, table)
}

export function insertDynamicTable(
  db: DatabaseWriter,
  table: string,
  doc: Record<string, Value>,
) {
  return (db as unknown as AnyDbWriter).insert(table, doc)
}

export function deleteDynamic(db: DatabaseWriter, id: Value) {
  return (db as unknown as AnyDbWriter).delete(id as GenericId<string>)
}

export function patchDynamic(
  db: DatabaseWriter,
  id: Value,
  fields: Record<string, unknown>,
) {
  return (db as unknown as AnyDbWriter).patch(
    id as GenericId<string>,
    fields as Record<string, Value>,
  )
}
