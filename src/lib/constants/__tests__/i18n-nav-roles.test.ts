import { describe, it, expect } from 'vitest'
import en from '../../../../messages/en.json'
import fr from '../../../../messages/fr.json'
import ko from '../../../../messages/ko.json'
import th from '../../../../messages/th.json'
import zhCN from '../../../../messages/zh-CN.json'
import zhTW from '../../../../messages/zh-TW.json'

const locales = [
  { name: 'en', nav: en.nav },
  { name: 'fr', nav: fr.nav },
  { name: 'ko', nav: ko.nav },
  { name: 'th', nav: th.nav },
  { name: 'zh-CN', nav: zhCN.nav },
  { name: 'zh-TW', nav: zhTW.nav },
]

describe('nav.roles key present in all locales', () => {
  for (const { name, nav } of locales) {
    it(`${name} has nav.roles`, () => {
      expect(typeof nav.roles).toBe('string')
      expect(nav.roles.length).toBeGreaterThan(0)
    })
  }

  it('en nav.roles is "Roles"', () => {
    expect(en.nav.roles).toBe('Roles')
  })

  it('fr nav.roles is "Rôles"', () => {
    expect(fr.nav.roles).toBe('Rôles')
  })

  it('ko nav.roles is "역할"', () => {
    expect(ko.nav.roles).toBe('역할')
  })

  it('th nav.roles is "บทบาท"', () => {
    expect(th.nav.roles).toBe('บทบาท')
  })

  it('zh-CN nav.roles is "角色"', () => {
    expect(zhCN.nav.roles).toBe('角色')
  })

  it('zh-TW nav.roles is "角色"', () => {
    expect(zhTW.nav.roles).toBe('角色')
  })
})
