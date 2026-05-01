import { describe, it, expect } from 'vitest'
import { RESOURCE_TAB_REQUIRED } from '../resource-tab-requirement'

describe('RESOURCE_TAB_REQUIRED', () => {
  it('every operator-resource sub-tab is persistently required', () => {
    expect(RESOURCE_TAB_REQUIRED.instructors).toBe(true)
    expect(RESOURCE_TAB_REQUIRED.equipment).toBe(true)
    expect(RESOURCE_TAB_REQUIRED.venues).toBe(true)
    expect(RESOURCE_TAB_REQUIRED.boats).toBe(true)
    expect(RESOURCE_TAB_REQUIRED.compressors).toBe(true)
  })

  it('operator sub-tab is never required', () => {
    expect(RESOURCE_TAB_REQUIRED.operator).toBe(false)
  })
})
