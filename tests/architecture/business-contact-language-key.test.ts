// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve } from 'path'

const REPO_ROOT = resolve(__dirname, '../..')
const PROFILES_DIR = resolve(REPO_ROOT, 'src/components/profiles')

function listProfileFormFiles(): string[] {
  const out: string[] = []
  for (const entry of readdirSync(PROFILES_DIR)) {
    const full = resolve(PROFILES_DIR, entry)
    const st = statSync(full)
    if (st.isDirectory()) continue
    if (!entry.endsWith('.tsx')) continue
    if (!entry.endsWith('-profile-form.tsx')) continue
    out.push(full)
  }
  return out
}

describe('architecture: BusinessContactSection language ownership via languageKey', () => {
  it('no role profile-form renders a <LanguageField /> inside an extras render prop', () => {
    const offending: string[] = []
    for (const file of listProfileFormFiles()) {
      const source = readFileSync(file, 'utf-8')
      if (!source.includes('BusinessContactSection')) continue
      if (!source.includes('extras={')) continue
      if (source.includes('<LanguageField')) {
        offending.push(file.replace(REPO_ROOT, '.'))
      }
    }
    expect(
      offending,
      `LanguageField found inline in profile forms that also pass extras to BusinessContactSection. ` +
        `Use the languageKey prop on BusinessContactSection — language rendering is owned there. ` +
        `Offenders:\n  ${offending.join('\n  ')}`,
    ).toEqual([])
  })

  it('no role profile-form imports LanguageField alongside BusinessContactSection', () => {
    const offending: string[] = []
    for (const file of listProfileFormFiles()) {
      const source = readFileSync(file, 'utf-8')
      if (!source.includes('BusinessContactSection')) continue
      if (
        /import\s+\{[^}]*\bLanguageField\b[^}]*\}\s+from\s+['"]@\/components\/ui\/language-field['"]/.test(
          source,
        )
      ) {
        offending.push(file.replace(REPO_ROOT, '.'))
      }
    }
    expect(
      offending,
      `LanguageField import detected in profile forms that delegate to BusinessContactSection. ` +
        `BusinessContactSection owns LanguageField rendering via the languageKey prop. ` +
        `Offenders:\n  ${offending.join('\n  ')}`,
    ).toEqual([])
  })
})
