import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { encryptMedical, decryptMedical, safeDecryptMedical } from './crypto'

describe('encryptMedical / decryptMedical', () => {
  const TEST_KEY = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=' // base64 of 32 'a' bytes

  beforeEach(() => {
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', TEST_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('roundtrips a medical answers record with boolean values', async () => {
    const input: Record<string, boolean | string> = {
      medical_q1: false,
      medical_q2: true,
      medical_q3: false,
      medical_q4: false,
      medical_q5: false,
      medical_q6: false,
      medical_q7: false,
      medical_q8: false,
      medical_q9: false,
      medical_q10: false,
    }
    const ciphertext = await encryptMedical(input)
    const decrypted = await decryptMedical(ciphertext)
    expect(decrypted).toEqual(input)
  })

  it('roundtrips a record with mixed boolean and string values', async () => {
    const input: Record<string, boolean | string> = {
      medical_q1: true,
      medical_q2: false,
      medical_details: 'Previous heart condition',
    }
    const ciphertext = await encryptMedical(input)
    const decrypted = await decryptMedical(ciphertext)
    expect(decrypted).toEqual(input)
  })

  it('produces different ciphertext for the same input (unique IV per call)', async () => {
    const input: Record<string, boolean | string> = { medical_q1: true }
    const ct1 = await encryptMedical(input)
    const ct2 = await encryptMedical(input)
    expect(ct1).not.toEqual(ct2)
  })

  it('output is prefixed with v1: version tag', async () => {
    const input: Record<string, boolean | string> = { medical_q1: true }
    const ciphertext = await encryptMedical(input)
    expect(ciphertext).toMatch(/^v1:/)
  })

  it('ciphertext payload after v1: prefix is base64 (no readable JSON)', async () => {
    const input: Record<string, boolean | string> = {
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
    const input: Record<string, boolean | string> = { medical_q1: false }
    const ciphertext = await encryptMedical(input)

    // Switch to a different key
    const wrongKey = 'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI=' // base64 of 32 'b' bytes
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', wrongKey)

    await expect(decryptMedical(ciphertext)).rejects.toThrow()
  })

  it('rejects decryption of corrupted ciphertext', async () => {
    const input: Record<string, boolean | string> = { medical_q1: true }
    const ciphertext = await encryptMedical(input)

    // Corrupt the ciphertext by flipping characters in the payload
    const corrupted = 'v1:' + ciphertext.slice(3, -4) + 'XXXX'

    await expect(decryptMedical(corrupted)).rejects.toThrow()
  })

  it('throws when MEDICAL_ENCRYPTION_KEY is not set', async () => {
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', '')
    const input: Record<string, boolean | string> = { medical_q1: false }
    await expect(encryptMedical(input)).rejects.toThrow('MEDICAL_ENCRYPTION_KEY')
  })

  it('roundtrips an empty record', async () => {
    const input: Record<string, boolean | string> = {}
    const ciphertext = await encryptMedical(input)
    const decrypted = await decryptMedical(ciphertext)
    expect(decrypted).toEqual(input)
  })

  it('handles unicode in string values', async () => {
    const input: Record<string, boolean | string> = {
      medical_q1: false,
      medical_details: 'โรคหัวใจ — ต้องการใบรับรองแพทย์',
    }
    const ciphertext = await encryptMedical(input)
    const decrypted = await decryptMedical(ciphertext)
    expect(decrypted).toEqual(input)
  })

  it('decrypts with rotated key using MEDICAL_ENCRYPTION_KEY_V1 fallback', async () => {
    const input: Record<string, boolean | string> = { medical_q1: true }
    // Encrypt with current key (TEST_KEY, which becomes the "old" key)
    const ciphertext = await encryptMedical(input)

    // Simulate key rotation: new key is primary, old key is V1 fallback
    const newKey = 'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI=' // base64 of 32 'b' bytes
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', newKey)
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY_V1', TEST_KEY)

    const decrypted = await decryptMedical(ciphertext)
    expect(decrypted).toEqual(input)
  })
})

describe('safeDecryptMedical', () => {
  const TEST_KEY = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=' // base64 of 32 'a' bytes
  const WRONG_KEY = 'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI=' // base64 of 32 'b' bytes

  beforeEach(() => {
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', TEST_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('decrypts valid v1-prefixed encrypted data', async () => {
    const input: Record<string, boolean | string> = { medical_q1: true, medical_q2: false }
    const ciphertext = await encryptMedical(input)
    const result = await safeDecryptMedical(ciphertext)
    expect(result).toEqual(input)
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
    const input: Record<string, boolean | string> = { medical_q1: true }
    const ciphertext = await encryptMedical(input)

    // Switch to wrong key — no V1 fallback set
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', WRONG_KEY)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await safeDecryptMedical(ciphertext)
    expect(result).toEqual({})

    // Should have logged a warning (not silently succeeded via JSON.parse)
    const logCalls = logSpy.mock.calls.map((args) => args[0])
    const warnEntry = logCalls.find(
      (entry) => typeof entry === 'string' && entry.includes('"level":"warn"')
    )
    expect(warnEntry).toBeDefined()
    const logMessage = typeof warnEntry === 'string' ? warnEntry : JSON.stringify(warnEntry)
    expect(logMessage).toContain('failed')
    expect(logMessage).toContain('versioned ciphertext')

    // Should also have logged an error about missing fallback key
    const errorEntry = logCalls.find(
      (entry) => typeof entry === 'string' && entry.includes('"level":"error"')
    )
    expect(errorEntry).toBeDefined()
    const errorMessage = typeof errorEntry === 'string' ? errorEntry : JSON.stringify(errorEntry)
    expect(errorMessage).toContain('no fallback key configured')
    expect(errorMessage).toContain('MEDICAL_ENCRYPTION_KEY_V1')

    logSpy.mockRestore()
  })

  it('returns empty object for non-object JSON (string)', async () => {
    const result = await safeDecryptMedical('"just a string"')
    expect(result).toEqual({})
  })

  it('returns empty object for non-object JSON (array)', async () => {
    const result = await safeDecryptMedical('[1,2,3]')
    expect(result).toEqual({})
  })

  it('returns empty object for non-object JSON (null)', async () => {
    const result = await safeDecryptMedical('null')
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
    const input: Record<string, boolean | string> = { medical_q1: true }
    const ciphertext = await encryptMedical(input)

    // Rotate: new primary key, old key saved as V1 fallback
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', WRONG_KEY)
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY_V1', TEST_KEY)

    const result = await safeDecryptMedical(ciphertext)
    expect(result).toEqual(input)
  })
})
