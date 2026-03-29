/**
 * Application-level encryption for medical data at rest.
 *
 * Uses AES-256-GCM via the Web Crypto API (available in Convex V8 runtime).
 * Key is read from the MEDICAL_ENCRYPTION_KEY environment variable (base64-encoded 32-byte key).
 *
 * Wire format: base64(IV || ciphertext || authTag)
 *   - IV: 12 bytes (AES-GCM standard)
 *   - ciphertext: variable length
 *   - authTag: 16 bytes (128-bit, included by Web Crypto in the ciphertext output)
 */

import { log } from './logger'

type MedicalAnswers = Record<string, boolean | string>

const IV_LENGTH = 12

/**
 * Import the AES-256-GCM key from the environment variable.
 * Throws if the key is missing or malformed.
 */
async function importKey(): Promise<CryptoKey> {
  const b64Key = process.env.MEDICAL_ENCRYPTION_KEY
  if (!b64Key) {
    throw new Error(
      'MEDICAL_ENCRYPTION_KEY environment variable is not set. ' +
      'Set it to a base64-encoded 32-byte key.'
    )
  }

  const rawKey = Uint8Array.from(atob(b64Key), (c) => c.charCodeAt(0))
  if (rawKey.length !== 32) {
    throw new Error(
      `MEDICAL_ENCRYPTION_KEY must decode to exactly 32 bytes, got ${rawKey.length}`
    )
  }

  return globalThis.crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encrypt a medical answers record into a base64-encoded ciphertext string.
 *
 * Format: base64(IV || ciphertext+authTag)
 */
export async function encryptMedical(data: MedicalAnswers): Promise<string> {
  const key = await importKey()
  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  )

  // Combine IV + encrypted (which includes the auth tag)
  const combined = new Uint8Array(IV_LENGTH + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), IV_LENGTH)

  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt a base64-encoded ciphertext string back into a medical answers record.
 *
 * Throws if the key is wrong, the ciphertext is corrupted, or the auth tag is invalid.
 */
export async function decryptMedical(ciphertext: string): Promise<MedicalAnswers> {
  const key = await importKey()
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))

  if (combined.length < IV_LENGTH + 1) {
    throw new Error('Ciphertext too short to contain IV and data')
  }

  const iv = combined.slice(0, IV_LENGTH)
  const encryptedData = combined.slice(IV_LENGTH)

  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData,
  )

  const json = new TextDecoder().decode(decrypted)
  return JSON.parse(json) as MedicalAnswers
}

/**
 * Safe wrapper around decryptMedical that handles:
 * 1. Decryption failures (corrupt data, wrong key) — returns empty object
 * 2. Legacy plaintext JSON records (pre-encryption migration) — parses directly
 *
 * Use this everywhere instead of bare decryptMedical in query/mutation handlers.
 */
export async function safeDecryptMedical(storedValue: string): Promise<MedicalAnswers> {
  try {
    return await decryptMedical(storedValue)
  } catch (e) {
    // Legacy path: old records may be stored as plaintext JSON
    try {
      const parsed = JSON.parse(storedValue)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as MedicalAnswers
      }
    } catch {
      // Not valid JSON either — unrecoverable
    }
    log.warn('safeDecryptMedical failed — returning empty record', {
      error: e instanceof Error ? e.message : String(e),
    })
    return {}
  }
}
