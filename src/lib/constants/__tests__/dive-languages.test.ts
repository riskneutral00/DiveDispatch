import { describe, it, expect } from 'vitest'
import { CHINESE_SCRIPT_LABELS, type LanguageCode } from '../dive-languages'

describe('CHINESE_SCRIPT_LABELS', () => {
  it('maps zh-CN to 简体 (Simplified Chinese)', () => {
    expect(CHINESE_SCRIPT_LABELS['zh-CN' as LanguageCode]).toBe('简体')
  })

  it('maps zh-TW to 繁體 (Traditional Chinese)', () => {
    expect(CHINESE_SCRIPT_LABELS['zh-TW' as LanguageCode]).toBe('繁體')
  })

  it('does not map non-Chinese codes', () => {
    expect(CHINESE_SCRIPT_LABELS['en-GB' as LanguageCode]).toBeUndefined()
    expect(CHINESE_SCRIPT_LABELS['ja-JP' as LanguageCode]).toBeUndefined()
  })
})
