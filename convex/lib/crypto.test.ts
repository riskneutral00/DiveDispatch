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

  it('ciphertext is not readable JSON', async () => {
    const input: Record<string, boolean | string> = {
      medical_q1: true,
      medical_details: 'Heart condition',
    }
    const ciphertext = await encryptMedical(input)
    // Should not contain plaintext values
    expect(ciphertext).not.toContain('Heart condition')
    expect(ciphertext).not.toContain('medical_q1')
    // Should be base64 — no curly braces
    expect(ciphertext).not.toContain('{')
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

    // Corrupt the ciphertext by flipping characters
    const corrupted = ciphertext.slice(0, -4) + 'XXXX'

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
})

describe('safeDecryptMedical', () => {
  const TEST_KEY = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=' // base64 of 32 'a' bytes

  beforeEach(() => {
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', TEST_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('decrypts valid encrypted data', async () => {
    const input: Record<string, boolean | string> = { medical_q1: true, medical_q2: false }
    const ciphertext = await encryptMedical(input)
    const result = await safeDecryptMedical(ciphertext)
    expect(result).toEqual(input)
  })

  it('parses legacy plaintext JSON records', async () => {
    const legacy = JSON.stringify({ medical_q1: true, medical_q2: false })
    const result = await safeDecryptMedical(legacy)
    expect(result).toEqual({ medical_q1: true, medical_q2: false })
  })

  it('returns empty object for corrupted ciphertext that is not JSON', async () => {
    const result = await safeDecryptMedical('not-base64-and-not-json!!!')
    expect(result).toEqual({})
  })

  it('returns empty object when key is wrong', async () => {
    const input: Record<string, boolean | string> = { medical_q1: true }
    const ciphertext = await encryptMedical(input)

    // Switch to wrong key
    vi.stubEnv('MEDICAL_ENCRYPTION_KEY', 'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI=')
    const result = await safeDecryptMedical(ciphertext)
    expect(result).toEqual({})
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
})
