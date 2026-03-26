import { describe, expect, it } from 'vitest'
import { getFlagEmoji } from '../countries'

describe('getFlagEmoji', () => {
  it('returns correct flag for US', () => {
    expect(getFlagEmoji('US')).toBe('🇺🇸')
  })

  it('returns correct flag for TH', () => {
    expect(getFlagEmoji('TH')).toBe('🇹🇭')
  })

  it('returns globe for empty string', () => {
    expect(getFlagEmoji('')).toBe('🌐')
  })

  it('returns globe for single-character code', () => {
    expect(getFlagEmoji('X')).toBe('🌐')
  })
})
