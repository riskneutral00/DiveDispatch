// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const REPO_ROOT = resolve(__dirname, '../..')
const SCHEMA_PATH = resolve(REPO_ROOT, 'convex/schema.ts')
const DIVE_STAFF_PATH = resolve(REPO_ROOT, 'convex/diveStaff.ts')
const ZOD_SCHEMA_PATH = resolve(REPO_ROOT, 'src/lib/schemas/profile-shared.ts')

describe('architecture: credential.specialtyRatings is required-array everywhere', () => {
  it('convex/schema.ts diveStaff.credential element validator declares specialtyRatings as required v.array', () => {
    const source = readFileSync(SCHEMA_PATH, 'utf-8')
    const diveStaffBlock = source.split('diveStaff: defineTable(')[1]?.split('boats: defineTable(')[0] ?? ''
    const credentialBlock = diveStaffBlock.split('credential: v.array(')[1]?.split(']),')[0] ?? ''
    expect(credentialBlock).toMatch(/specialtyRatings:\s*v\.array\(v\.string\(\)\)/)
    expect(credentialBlock).not.toMatch(/specialtyRatings:\s*v\.optional\(/)
  })

  it('convex/diveStaff.ts credentialValidator declares specialtyRatings as required v.array', () => {
    const source = readFileSync(DIVE_STAFF_PATH, 'utf-8')
    const validatorBlock = source.split('credentialValidator = v.object({')[1]?.split('})')[0] ?? ''
    expect(validatorBlock).toMatch(/specialtyRatings:\s*v\.array\(v\.string\(\)\)/)
    expect(validatorBlock).not.toMatch(/specialtyRatings:\s*v\.optional\(/)
  })

  it('src/lib/schemas/profile-shared.ts instructorCredentialSchema declares specialtyRatings as required z.array', () => {
    const source = readFileSync(ZOD_SCHEMA_PATH, 'utf-8')
    const schemaBlock =
      source.split('instructorCredentialSchema')[1]?.split('export ')[0] ?? ''
    expect(schemaBlock).toMatch(/specialtyRatings:\s*z\.array\(z\.string\(\)\)/)
    expect(schemaBlock).not.toMatch(/specialtyRatings:\s*z\.array\(z\.string\(\)\)\.optional\(\)/)
  })
})
