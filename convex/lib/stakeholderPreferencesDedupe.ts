import type { Doc, Id } from '../_generated/dataModel'

/**
 * Given all stakeholderPreferences docs, returns IDs to delete so at most one
 * row per stakeholderId remains (keeps lowest `_creationTime` per slug).
 */
export function stakeholderPreferenceIdsToDelete(
  docs: Doc<'stakeholderPreferences'>[],
): Id<'stakeholderPreferences'>[] {
  const bySlug = new Map<string, Doc<'stakeholderPreferences'>[]>()
  for (const doc of docs) {
    const list = bySlug.get(doc.stakeholderId) ?? []
    list.push(doc)
    bySlug.set(doc.stakeholderId, list)
  }
  const toDelete: Id<'stakeholderPreferences'>[] = []
  for (const [, group] of bySlug) {
    if (group.length <= 1) continue
    group.sort((a, b) => a._creationTime - b._creationTime)
    const [, ...rest] = group
    for (const d of rest) {
      toDelete.push(d._id)
    }
  }
  return toDelete
}
