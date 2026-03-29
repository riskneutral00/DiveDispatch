import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { encryptMedical, decryptMedical, safeDecryptMedical } from './crypto'
import type { MedicalRecord } from '../../tests/helpers/crypto'

const TEST_KEY = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
const WRONG_KEY = 'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI='

describe('encryptMedical / decryptMedical', () => {
  beforeEach(() => {
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', TEST_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('roundtrips a record with mixed boolean and string values', async () => {
    const input: MedicalRecord = {
      medical_q1: true,
      medical_q2: false,
      medical_details: 'Previous heart condition',
    }
    const ciphertext = await encryptMedical(input)
    const decrypted = await decryptMedical(ciphertext)
    expect(decrypted).toEqual(input)
  })

  it('produces different ciphertext for the same input (unique IV per call)', async () => {
    const input: MedicalRecord = { medical_q1: true }
    const ct1 = await encryptMedical(input)
    const ct2 = await encryptMedical(input)
    expect(ct1).not.toEqual(ct2)
  })

  it('output is prefixed with v1: version tag', async () => {
    const input: MedicalRecord = { medical_q1: true }
    const ciphertext = await encryptMedical(input)
    expect(ciphertext).toMatch(/^v1:/)
  })

  it('ciphertext payload after v1: prefix is base64 (no readable JSON)', async () => {
    const input: MedicalRecord = {
      medical_q1: true,
      medical_details: 'Heart condition',
    }
    const ciphertext = await encryptMedical(input)
    const payload = ciphertext.slice(3) // strip 'v1:'
    expect(payload).not.toContain('Heart condition')
    expect(payload).not.toContain('medical_q1')
    expect(payload).not.toContain('{')
  })

  it('rejects decryption with a wrong key', async () => {
    const input: MedicalRecord = { medical_q1: false }
    const ciphertext = await encryptMedical(input)

    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', WRONG_KEY)
    await expect(decryptMedical(ciphertext)).rejects.toThrow()
  })

  it('rejects decryption of corrupted ciphertext', async () => {
    const input: MedicalRecord = { medical_q1: true }
    const ciphertext = await encryptMedical(input)
    const corrupted = 'v1:' + ciphertext.slice(3, -4) + 'XXXX'

    await expect(decryptMedical(corrupted)).rejects.toThrow()
  })

  it('throws when MEDICAL_ENCRYPTION_KEY is not set', async () => {
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', '')
    const input: MedicalRecord = { medical_q1: false }
    await expect(encryptMedical(input)).rejects.toThrow('MEDICAL_ENCRYPTION_KEY')
  })

  it('roundtrips an empty record', async () => {
    const input: MedicalRecord = {}
    const ciphertext = await encryptMedical(input)
    const decrypted = await decryptMedical(ciphertext)
    expect(decrypted).toEqual(input)
  })

  it('handles unicode in string values', async () => {
    const input: MedicalRecord = {
      medical_q1: false,
      medical_details: 'โรคหัวใจ — ต้องการใบรับรองแพทย์',
    }
    const ciphertext = await encryptMedical(input)
    const decrypted = await decryptMedical(ciphertext)
    expect(decrypted).toEqual(input)
  })

  it('decrypts with rotated key using MEDICAL_ENCRYPTION_KEY_V1 fallback', async () => {
    const input: MedicalRecord = { medical_q1: true }
    const ciphertext = await encryptMedical(input)

    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', WRONG_KEY)
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY_V1', TEST_KEY)

    const decrypted = await decryptMedical(ciphertext)
    expect(decrypted).toEqual(input)
  })
})

describe('safeDecryptMedical', () => {
  beforeEach(() => {
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', TEST_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('parses legacy plaintext JSON records (no version prefix)', async () => {
    const legacy = JSON.stringify({ medical_q1: true, medical_q2: false })
    const result = await safeDecryptMedical(legacy)
    expect(result).toEqual({ medical_q1: true, medical_q2: false })
  })

  it('returns empty object for unversioned garbage that is not JSON', async () => {
    const result = await safeDecryptMedical('not-base64-and-not-json!!!')
    expect(result).toEqual({})
  })

  it('versioned ciphertext with wrong key returns {} without falling through to JSON.parse', async () => {
    const input: MedicalRecord = { medical_q1: true }
    const ciphertext = await encryptMedical(input)

    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', WRONG_KEY)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await safeDecryptMedical(ciphertext)
    expect(result).toEqual({})

    const logCalls = logSpy.mock.calls.map((args) => args[0])
    const warnEntry = logCalls.find(
      (entry) => typeof entry === 'string' && entry.includes('"level":"warn"')
    )
    expect(warnEntry).toBeDefined()
    const logMessage = typeof warnEntry === 'string' ? warnEntry : JSON.stringify(warnEntry)
    expect(logMessage).toContain('failed')
    expect(logMessage).toContain('versioned ciphertext')

    const errorEntry = logCalls.find(
      (entry) => typeof entry === 'string' && entry.includes('"level":"error"')
    )
    expect(errorEntry).toBeDefined()
    const errorMessage = typeof errorEntry === 'string' ? errorEntry : JSON.stringify(errorEntry)
    expect(errorMessage).toContain('no fallback key configured')
    expect(errorMessage).toContain('MEDICAL_ENCRYPTION_KEY_V1')

    logSpy.mockRestore()
  })

  it.each([
    ['"just a string"'],
    ['[1,2,3]'],
    ['null'],
  ])('returns empty object for non-object JSON: %s', async (input) => {
    const result = await safeDecryptMedical(input)
    expect(result).toEqual({})
  })

  it('handles legacy plaintext with mixed boolean and string values', async () => {
    const legacy = JSON.stringify({
      medical_q1: true,
      medical_details: 'Heart condition',
    })
    const result = await safeDecryptMedical(legacy)
    expect(result).toEqual({ medical_q1: true, medical_details: 'Heart condition' })
  })

  it('versioned ciphertext decrypts via V1 fallback key when primary key is rotated', async () => {
    const input: MedicalRecord = { medical_q1: true }
    const ciphertext = await encryptMedical(input)

    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', WRONG_KEY)
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY_V1', TEST_KEY)

    const result = await safeDecryptMedical(ciphertext)
    expect(result).toEqual(input)
  })
})
