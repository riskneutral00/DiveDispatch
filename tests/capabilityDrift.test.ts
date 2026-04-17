import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  AGENCY_CONFIGS,
  PADI,
  SSI,
  ACTIVITY_CODES,
} from '../convex/shared/activityCatalog'

const VAULT_PATH = resolve(__dirname, '../../Vaults/DiveDispatch/Product/SpecialtyMatrix.md')

function parseCols(line: string): string[] {
  return line.split('|').map((c) => c.trim())
}

function headerIndex(headers: string[], name: string): number {
  const idx = headers.findIndex((h) => h.toLowerCase().includes(name.toLowerCase()))
  if (idx === -1) throw new Error(`Column "${name}" not found in header: ${headers.join(' | ')}`)
  return idx
}

function parseSpecialtyMatrix(): string[] {
  const content = readFileSync(VAULT_PATH, 'utf-8')
  const lines = content.split('\n')
  const matrixStart = lines.findIndex((l) => l.startsWith('| Category'))
  if (matrixStart === -1) throw new Error('Cannot find matrix header in SpecialtyMatrix.md')

  const headers = parseCols(lines[matrixStart])
  const topicIdx = headerIndex(headers, 'Specialty Topic')

  const rows: string[] = []
  for (let i = matrixStart + 2; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('|')) break
    const cols = parseCols(line)
    if (cols[topicIdx]) rows.push(cols[topicIdx])
  }
  return rows
}

function parseAutomaticAuthority(): Array<{ topic: string; adventureDive: string }> {
  const content = readFileSync(VAULT_PATH, 'utf-8')
  const lines = content.split('\n')
  const matrixStart = lines.findIndex((l) => l.startsWith('| Category'))
  if (matrixStart === -1) return []

  const headers = parseCols(lines[matrixStart])
  const topicIdx = headerIndex(headers, 'Specialty Topic')
  const advIdx = headerIndex(headers, 'PADI: Standard Instructor')
  const specIdx = headerIndex(headers, 'PADI: "Specialty Instructor"')

  const authority: Array<{ topic: string; adventureDive: string }> = []
  for (let i = matrixStart + 2; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('|')) break
    const cols = parseCols(line)
    if (cols[specIdx]?.includes('(Automatic Authority)')) {
      if (cols[topicIdx]) authority.push({ topic: cols[topicIdx], adventureDive: cols[advIdx] || '' })
    }
  }
  return authority
}

function parseAgencyHierarchy(): Array<{ padi: string; ssi: string }> {
  const content = readFileSync(VAULT_PATH, 'utf-8')
  const lines = content.split('\n')
  const hierarchyStart = lines.findIndex((l) => l.includes('Agency Hierarchy'))
  if (hierarchyStart === -1) throw new Error('Cannot find Agency Hierarchy section')

  const headerLine = lines.slice(hierarchyStart).findIndex((l) => l.startsWith('| PADI'))
  if (headerLine === -1) throw new Error('Cannot find hierarchy table header')

  const rows: Array<{ padi: string; ssi: string }> = []
  const start = hierarchyStart + headerLine + 2
  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('|')) break
    const cols = line.split('|').map((c) => c.trim()).filter(Boolean)
    if (cols.length >= 2) {
      rows.push({ padi: cols[0].split('(')[0].trim(), ssi: cols[1].split('(')[0].trim() })
    }
  }
  return rows
}

describe('vault ↔ code parity: specialty count', () => {
  const vaultTopics = parseSpecialtyMatrix()

  it('vault has exactly 23 specialty rows', () => {
    expect(vaultTopics.length).toBe(23)
  })

  it('PADI config has 23 specialties', () => {
    expect(PADI.specialties.length).toBe(23)
  })

  it('SSI config has 23 specialties', () => {
    expect(SSI.specialties.length).toBe(23)
  })
})

describe('vault ↔ code parity: automatic authority', () => {
  const vaultAA = parseAutomaticAuthority()

  it('vault automatic authority topics match code', () => {
    const codeAA = [...PADI.automaticAuthority].sort()
    expect(vaultAA.length).toBe(codeAA.length)

    const vaultTopicCodes = vaultAA
      .map(({ topic, adventureDive }) => {
        return PADI.specialties.find((s) => {
          if (adventureDive && s.adventureDiveName === adventureDive) return true
          return s.code === topic || s.label === topic
        })?.code
      })
      .filter(Boolean)
      .sort()

    expect(vaultTopicCodes).toEqual(codeAA)
  })

  it('PADI and SSI agree on automatic authority', () => {
    expect([...PADI.automaticAuthority].sort()).toEqual([...SSI.automaticAuthority].sort())
  })
})

describe('vault ↔ code parity: agency hierarchy', () => {
  const vaultHierarchy = parseAgencyHierarchy()

  it('vault hierarchy has 5 rows', () => {
    expect(vaultHierarchy.length).toBe(5)
  })

  it('every PADI level in vault exists in code', () => {
    const codeLevels = new Set(PADI.levels.map((l) => l.code))
    for (const row of vaultHierarchy) {
      expect(codeLevels.has(row.padi), `Missing PADI level: ${row.padi}`).toBe(true)
    }
  })

  it('every SSI level in vault exists in code', () => {
    const codeLevels = new Set(SSI.levels.map((l) => l.code))
    for (const row of vaultHierarchy) {
      expect(codeLevels.has(row.ssi), `Missing SSI level: ${row.ssi}`).toBe(true)
    }
  })
})

describe('activity code coverage', () => {
  it('every ACTIVITY_CODE has a rule in PADI config', () => {
    for (const code of ACTIVITY_CODES) {
      expect(PADI.activityRules[code], `Missing PADI rule for ${code}`).toBeDefined()
    }
  })

  it('every ACTIVITY_CODE has a rule in SSI config', () => {
    for (const code of ACTIVITY_CODES) {
      expect(SSI.activityRules[code], `Missing SSI rule for ${code}`).toBeDefined()
    }
  })
})

describe('isInstructor consistency', () => {
  for (const [name, config] of Object.entries(AGENCY_CONFIGS)) {
    it(`${name} has at least one non-instructor level (DM/equivalent)`, () => {
      const hasNonInstructor = config.levels.some((l) => !l.isInstructor)
      expect(hasNonInstructor, `${name} missing non-instructor level`).toBe(true)
    })

    it(`${name} has at least one instructor level`, () => {
      const hasInstructor = config.levels.some((l) => l.isInstructor)
      expect(hasInstructor, `${name} missing instructor level`).toBe(true)
    })
  }
})
