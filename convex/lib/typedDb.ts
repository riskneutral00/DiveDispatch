/**
 * Type-safe wrappers for dynamic table queries.
 *
 * Convex's generated types require literal table names. When a table name
 * is a runtime variable, `db.query(name)` won't compile without an
 * assertion. These helpers centralise the assertion so call sites never
 * use `as any`.
 *
 * `queryDynamicTable(db, variable)` returns a generic query that accepts
 * any index name and yields `GenericDocument`. Companion helpers
 * `insertDynamicTable`, `deleteDynamic`, and `patchDynamic` cover writes.
 */
import type { GenericTableInfo, GenericDatabaseReader, GenericDatabaseWriter, GenericDataModel, QueryInitializer } from 'convex/server'
import type { GenericId, Value } from 'convex/values'
import type { DatabaseReader, DatabaseWriter } from '../_generated/server'

// ── Dynamic table name (runtime string) ───────────────────────────────

/** Generic DB reader that accepts any table name string. */
type AnyDbReader = GenericDatabaseReader<GenericDataModel>

/** Generic DB writer that accepts any table name string. */
type AnyDbWriter = GenericDatabaseWriter<GenericDataModel>

/**
 * Query a table whose name is only known at runtime. Returns a generic
 * query builder that accepts any index name — no `as any` required at
 * the call site.
 */
export function queryDynamicTable(
  db: DatabaseReader,
  table: string,
): QueryInitializer<GenericTableInfo> {
  return (db as unknown as AnyDbReader).query(table)
}

/**
 * Insert into a table whose name is only known at runtime.
 */
export function insertDynamicTable(
  db: DatabaseWriter,
  table: string,
  doc: Record<string, Value>,
) {
  return (db as unknown as AnyDbWriter).insert(table, doc)
}

/**
 * Delete a document by its generic ID (from a dynamic table query).
 */
export function deleteDynamic(db: DatabaseWriter, id: Value) {
  return (db as unknown as AnyDbWriter).delete(id as GenericId<string>)
}

/**
 * Patch a document by its generic ID (from a dynamic table query).
 */
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
