import { describe, it, expect } from 'vitest'
import { enumToDisplayLabel } from '../strings'

describe('enumToDisplayLabel', () => {
  it('capitalizes a single lowercase word', () => {
    expect(enumToDisplayLabel('boat')).toBe('Boat')
  })

  it('converts SCREAMING_SNAKE to Title Case Words', () => {
    expect(enumToDisplayLabel('DAY_BOAT')).toBe('Day Boat')
    expect(enumToDisplayLabel('LIVEABOARD')).toBe('Liveaboard')
    expect(enumToDisplayLabel('OPEN_WATER_DIVER')).toBe('Open Water Diver')
  })

  it('converts snake_case to Title Case Words', () => {
    expect(enumToDisplayLabel('dive_site')).toBe('Dive Site')
    expect(enumToDisplayLabel('pool')).toBe('Pool')
  })

  it('handles a leading or trailing underscore gracefully', () => {
    expect(enumToDisplayLabel('_dive')).toBe(' Dive')
    expect(enumToDisplayLabel('dive_')).toBe('Dive ')
  })

  it('returns an empty string for empty input', () => {
    expect(enumToDisplayLabel('')).toBe('')
  })

  it('preserves a single character word', () => {
    expect(enumToDisplayLabel('a')).toBe('A')
  })
})
