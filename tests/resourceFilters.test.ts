import { describe, it, expect } from 'vitest'
import {
  LANGUAGE_FILTER,
  INSTRUCTOR_FILTERS,
  BOAT_FILTERS,
  COMPRESSOR_FILTERS,
  EQUIPMENT_FILTERS,
  NO_FILTERS,
  ROLE_FILTERS,
} from '../src/lib/constants/resource-filters'

describe('LANGUAGE_FILTER', () => {
  it('has id "language"', () => {
    expect(LANGUAGE_FILTER.id).toBe('language')
  })

  it('is a multi-select filter', () => {
    expect(LANGUAGE_FILTER.multiSelect).toBe(true)
  })

  it('first option is "All Languages"', () => {
    expect(LANGUAGE_FILTER.options[0].value).toBe('all')
  })
})

describe('INSTRUCTOR_FILTERS', () => {
  it('includes agency and language filters', () => {
    const ids = INSTRUCTOR_FILTERS.map((f) => f.id)
    expect(ids).toContain('agency')
    expect(ids).toContain('language')
  })
})

describe('BOAT_FILTERS', () => {
  it('includes minCapacity filter', () => {
    expect(BOAT_FILTERS[0].id).toBe('minCapacity')
  })
})

describe('COMPRESSOR_FILTERS', () => {
  it('includes gasMix filter', () => {
    expect(COMPRESSOR_FILTERS[0].id).toBe('gasMix')
  })

  it('gasMix is multi-select', () => {
    expect(COMPRESSOR_FILTERS[0].multiSelect).toBe(true)
  })
})

describe('EQUIPMENT_FILTERS', () => {
  it('includes category filter', () => {
    expect(EQUIPMENT_FILTERS[0].id).toBe('category')
  })
})

describe('ROLE_FILTERS', () => {
  it('maps Instructor to INSTRUCTOR_FILTERS', () => {
    expect(ROLE_FILTERS.Instructor).toBe(INSTRUCTOR_FILTERS)
  })

  it('maps Boat to BOAT_FILTERS', () => {
    expect(ROLE_FILTERS.Boat).toBe(BOAT_FILTERS)
  })

  it('maps DiveCenter to NO_FILTERS', () => {
    expect(ROLE_FILTERS.DiveCenter).toBe(NO_FILTERS)
  })

  it('maps DiveMaster to language filter only', () => {
    expect(ROLE_FILTERS.DiveMaster).toHaveLength(1)
    expect(ROLE_FILTERS.DiveMaster[0].id).toBe('language')
  })

  it('all roles are defined', () => {
    const expected = [
      'DiveCenter', 'Agent', 'Instructor', 'Boat', 'Equipment',
      'Pool', 'Compressor', 'DiveMaster', 'Liveaboard', 'DiveResort',
      'DiveHostel', 'DiveSite',
    ]
    for (const role of expected) {
      expect(ROLE_FILTERS).toHaveProperty(role)
    }
  })
})
