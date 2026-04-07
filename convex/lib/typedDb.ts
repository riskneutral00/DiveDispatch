import type { GenericTableInfo, GenericDatabaseReader, GenericDatabaseWriter, GenericDataModel, QueryInitializer } from 'convex/server'
import type { GenericId, Value } from 'convex/values'
import type { DatabaseReader, DatabaseWriter } from '../_generated/server'

type AnyDbReader = GenericDatabaseReader<GenericDataModel>

type AnyDbWriter = GenericDatabaseWriter<GenericDataModel>

export function queryDynamicTable(
  db: DatabaseReader,
  table: string,
): QueryInitializer<GenericTableInfo> {
  return (db as unknown as AnyDbReader).query(table)
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
