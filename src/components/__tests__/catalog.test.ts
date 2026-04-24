import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const COMPONENTS_ROOT = join(__dirname, '..')
const SRC_ROOT = join(__dirname, '../..')
const CATALOG_PATH = join(COMPONENTS_ROOT, 'CATALOG.md')
const UI_DIR = join(COMPONENTS_ROOT, 'ui')
const PROFILES_DIR = join(COMPONENTS_ROOT, 'profiles')

const catalog = readFileSync(CATALOG_PATH, 'utf8')

const listTsx = (dir: string, exclude: (name: string) => boolean): string[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.tsx'))
    .filter((f) => !f.endsWith('.stories.tsx'))
    .filter((f) => !f.endsWith('.test.tsx'))
    .map((f) => f.replace(/\.tsx$/, ''))
    .filter((name) => !exclude(name))

function walkTsx(root: string, out: string[] = []): string[] {
  for (const entry of readdirSync(root)) {
    const full = join(root, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === '_generated' || entry === 'node_modules' || entry === 'dev') continue
      walkTsx(full, out)
      continue
    }
    if (!entry.endsWith('.tsx')) continue
    if (entry.endsWith('.test.tsx') || entry.endsWith('.stories.tsx')) continue
    out.push(full)
  }
  return out
}

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

  it('every cataloged component is imported somewhere in src/', () => {
    const toPascal = (slug: string): string =>
      slug
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    type Entry = { deepPath: string; symbolRe: RegExp }
    const cataloged: Entry[] = []
    const seen = new Set<string>()
    const importPattern = /@\/components\/(ui|profiles|booking)\/([a-z0-9-]+)/g
    for (const match of catalog.matchAll(importPattern)) {
      const deepPath = `@/components/${match[1]}/${match[2]}`
      if (seen.has(deepPath)) continue
      seen.add(deepPath)
      const symbol = toPascal(match[2])
      const symbolRe = new RegExp(`\\b${symbol}\\b`)
      cataloged.push({ deepPath, symbolRe })
    }
    const allTsx = walkTsx(SRC_ROOT)
    const importedAt: Record<string, string[]> = {}
    for (const { deepPath } of cataloged) importedAt[deepPath] = []
    for (const file of allTsx) {
      if (file.includes('/__tests__/')) continue
      const content = readFileSync(file, 'utf8')
      for (const { deepPath, symbolRe } of cataloged) {
        if (content.includes(deepPath) || symbolRe.test(content)) {
          importedAt[deepPath].push(relative(SRC_ROOT, file))
        }
      }
    }
    const orphaned = Object.entries(importedAt)
      .filter(([, sites]) => sites.length === 0)
      .map(([path]) => path)
    expect(orphaned).toEqual([])
  })

  it('no hand-rolled dialog footer outside ui/', () => {
    const offenders: string[] = []
    const re = /<div[^>]*className=["'`][^"'`]*flex[^"'`]*justify-end[^"'`]*["'`][^>]*>\s*(?:<[A-Za-z][^>]*>[^<]*<\/[A-Za-z]+>\s*){2,}/
    for (const file of walkTsx(COMPONENTS_ROOT)) {
      if (file.includes('/components/ui/')) continue
      if (file.endsWith('confirm-dialog.tsx')) continue
      const content = readFileSync(file, 'utf8')
      if (re.test(content)) {
        offenders.push(relative(SRC_ROOT, file))
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Hand-rolled dialog footer detected outside ui/. Use DialogFooter from @/components/ui/dialog. Offenders:\n${offenders.join('\n')}`,
      )
    }
  })

  it('no hand-rolled card-title heading outside ui/', () => {
    const offenders: string[] = []
    const re = /<h[23][^>]*className=["'`][^"'`]*(?:text-card-title|font-heading)[^"'`]*["'`]/
    for (const file of walkTsx(COMPONENTS_ROOT)) {
      if (file.includes('/components/ui/')) continue
      const content = readFileSync(file, 'utf8')
      if (re.test(content)) {
        offenders.push(relative(SRC_ROOT, file))
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Hand-rolled <h2>/<h3> with text-card-title or font-heading detected outside ui/. Use CardTitle (size="md" or "sm") from @/components/ui/card-title. Offenders:\n${offenders.join('\n')}`,
      )
    }
  })
})
