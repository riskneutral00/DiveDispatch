import { describe, expect, it } from 'vitest'
import type { Doc, Id } from '../_generated/dataModel'
import { stakeholderPreferenceIdsToDelete } from './stakeholderPreferencesDedupe'

function mockDoc(
  id: string,
  stakeholderId: string,
  _creationTime: number,
): Doc<'stakeholderPreferences'> {
  return {
    _id: id as Id<'stakeholderPreferences'>,
    _creationTime,
    stakeholderId,
    stakeholderType: 'DiveCenter',
    useNamedUnits: false,
    commonLanguageCodes: [],
    confirmOnAccept: false,
    confirmOnDecline: false,
  }
}

describe('stakeholderPreferenceIdsToDelete', () => {
  it('returns empty when no duplicates', () => {
    const docs = [mockDoc('a', 'slug1', 1), mockDoc('b', 'slug2', 2)]
    expect(stakeholderPreferenceIdsToDelete(docs)).toEqual([])
  })

  it('keeps oldest doc per stakeholderId and returns newer ids', () => {
    const docs = [
      mockDoc('keep', 'x', 100),
      mockDoc('drop1', 'x', 200),
      mockDoc('drop2', 'x', 300),
    ]
    const ids = stakeholderPreferenceIdsToDelete(docs)
    expect(ids.sort()).toEqual(['drop1', 'drop2'].sort())
  })
})
