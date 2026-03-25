import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'

const SCHEMA_PATH = resolve(
  dirname(new URL(import.meta.url).pathname),
  'schema.ts',
)

describe('monitoring schema', () => {
  it('cronRunLog table is defined in schema.ts', () => {
    const schema = readFileSync(SCHEMA_PATH, 'utf-8')
    expect(schema).toContain('cronRunLog: defineTable')
  })

  it('cronRunLog has by_jobName_runAt index', () => {
    const schema = readFileSync(SCHEMA_PATH, 'utf-8')
    expect(schema).toContain("by_jobName_runAt")
  })
})
