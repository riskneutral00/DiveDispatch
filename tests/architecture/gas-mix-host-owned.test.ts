// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const REPO_ROOT = resolve(__dirname, '../..')
const SCHEMA_PATH = resolve(REPO_ROOT, 'convex/schema.ts')

describe('architecture: gas-mix lives on the host', () => {
  it('boats schema exposes optional gasMixes/nitroxMin/nitroxMax', () => {
    const source = readFileSync(SCHEMA_PATH, 'utf-8')
    const boatsBlock = source.split('boats: defineTable(')[1]?.split('equipment: defineTable(')[0] ?? ''
    expect(boatsBlock).toMatch(/gasMixes:\s*v\.optional\(/)
    expect(boatsBlock).toMatch(/nitroxMin:\s*v\.optional\(/)
    expect(boatsBlock).toMatch(/nitroxMax:\s*v\.optional\(/)
  })

  it('venues schema exposes optional gasMixes/nitroxMin/nitroxMax', () => {
    const source = readFileSync(SCHEMA_PATH, 'utf-8')
    const venuesBlock = source.split('venues: defineTable(')[1]?.split('compressors: defineTable(')[0] ?? ''
    expect(venuesBlock).toMatch(/gasMixes:\s*v\.optional\(/)
    expect(venuesBlock).toMatch(/nitroxMin:\s*v\.optional\(/)
    expect(venuesBlock).toMatch(/nitroxMax:\s*v\.optional\(/)
  })

  it('compressors keep gasMixes (canonical fixed-location host)', () => {
    const source = readFileSync(SCHEMA_PATH, 'utf-8')
    const compressorsBlock =
      source.split('compressors: defineTable(')[1]?.split('inventoryUnits: defineTable(')[0] ?? ''
    expect(compressorsBlock).toMatch(/gasMixes:\s*v\.optional\(/)
  })

  it('validateNitroxRange is shared, not duplicated per host', () => {
    const sharedPath = resolve(REPO_ROOT, 'convex/lib/gasMixValidation.ts')
    const shared = readFileSync(sharedPath, 'utf-8')
    expect(shared).toMatch(/export function validateNitroxRange/)

    for (const file of ['convex/boats.ts', 'convex/venues.ts', 'convex/compressors.ts']) {
      const source = readFileSync(resolve(REPO_ROOT, file), 'utf-8')
      const localDef = /function\s+validateNitroxRange\s*\(/.test(source)
      expect(localDef, `${file} must import validateNitroxRange, not redefine it`).toBe(false)
      expect(source).toMatch(/validateNitroxRange/)
    }
  })
})
