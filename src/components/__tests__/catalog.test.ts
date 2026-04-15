import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const CATALOG_PATH = join(__dirname, '../CATALOG.md')
const UI_DIR = join(__dirname, '../ui')
const PROFILES_DIR = join(__dirname, '../profiles')

const catalog = readFileSync(CATALOG_PATH, 'utf8')

const listTsx = (dir: string, exclude: (name: string) => boolean): string[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.tsx'))
    .filter((f) => !f.endsWith('.stories.tsx'))
    .filter((f) => !f.endsWith('.test.tsx'))
    .map((f) => f.replace(/\.tsx$/, ''))
    .filter((name) => !exclude(name))

describe('component catalog', () => {
  it('mentions every src/components/ui primitive', () => {
    const primitives = listTsx(UI_DIR, () => false)
    const missing = primitives.filter((name) => !catalog.includes(`/ui/${name}`))
    expect(missing).toEqual([])
  })

  it('mentions every src/components/profiles composition', () => {
    const roleForms = (name: string) => name.endsWith('-profile-form')
    const lazyWrappers = (name: string) => name.endsWith('-lazy')
    const compositions = listTsx(
      PROFILES_DIR,
      (name) => roleForms(name) || lazyWrappers(name),
    )
    const missing = compositions.filter(
      (name) => !catalog.includes(`/profiles/${name}`),
    )
    expect(missing).toEqual([])
  })

  it('does not reference files that have been deleted', () => {
    const allFiles = new Set<string>([
      ...listTsx(UI_DIR, () => false).map((n) => `/ui/${n}`),
      ...listTsx(PROFILES_DIR, () => false).map((n) => `/profiles/${n}`),
    ])
    const importPattern = /@\/components\/(ui|profiles)\/([a-z0-9-]+)/g
    const referenced = new Set<string>()
    for (const match of catalog.matchAll(importPattern)) {
      referenced.add(`/${match[1]}/${match[2]}`)
    }
    const orphans = Array.from(referenced).filter((ref) => !allFiles.has(ref))
    expect(orphans).toEqual([])
  })
})
