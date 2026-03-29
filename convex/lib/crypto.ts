/**
 * Application-level encryption for medical data at rest.
 *
 * Uses AES-256-GCM via the Web Crypto API (available in Convex V8 runtime).
 * Key is read from the MEDICAL_ENCRYPTION_KEY environment variable (base64-encoded 32-byte key).
 *
 * Wire format: v{N}:{base64(IV || ciphertext || authTag)}
 *   - Version prefix: "v1:" (current version)
 *   - IV: 12 bytes (AES-GCM standard)
 *   - ciphertext: variable length
 *   - authTag: 16 bytes (128-bit, included by Web Crypto in the ciphertext output)
 *
 * Legacy (pre-versioned) wire format: base64(IV || ciphertext || authTag) — no prefix.
 * safeDecryptMedical handles both formats.
 *
 * ─── Key Rotation Procedure ────────────────────────────────────────────────
 * 1. Set MEDICAL_ENCRYPTION_KEY_V1=<current-key>
 * 2. Set MEDICAL_ENCRYPTION_KEY=<new-key>
 * 3. Deploy — reads succeed via V1 fallback, new writes use the new key
 * 4. Run migratePlaintextMedical to re-encrypt all records with the new key
 * 5. Remove MEDICAL_ENCRYPTION_KEY_V1 once migration is verified complete
 * ────────────────────────────────────────────────────────────────────────────
 */

import { log } from './logger'

type MedicalAnswers = Record<string, boolean | string>

const IV_LENGTH = 12
const CURRENT_VERSION = 'v1'
const VERSION_PREFIX_RE = /^v(\d+):/

/**
 * Import an AES-256-GCM key from a base64-encoded 32-byte string.
 * Throws if the key is missing or malformed.
 */
async function importKeyFromBase64(b64Key: string): Promise<CryptoKey> {
  const rawKey = Uint8Array.from(atob(b64Key), (c) => c.charCodeAt(0))
  if (rawKey.length !== 32) {
    throw new Error(
      `Encryption key must decode to exactly 32 bytes, got ${rawKey.length}`
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
 * Import the primary AES-256-GCM key from the environment variable.
 * Throws if MEDICAL_ENCRYPTION_KEY is missing or malformed.
 */
async function importKey(): Promise<CryptoKey> {
  const b64Key = process.env.MEDICAL_ENCRYPTION_KEY
  if (!b64Key) {
    throw new Error(
      'MEDICAL_ENCRYPTION_KEY environment variable is not set. ' +
      'Set it to a base64-encoded 32-byte key.'
    )
  }

  return importKeyFromBase64(b64Key)
}

/**
 * Import the fallback key for a given version, used during key rotation.
 * Returns null if the fallback env var is not set.
 */
async function importFallbackKey(version: string): Promise<CryptoKey | null> {
  const envVar = `MEDICAL_ENCRYPTION_KEY_${version.toUpperCase()}`
  const b64Key = process.env[envVar]
  if (!b64Key) {
    return null
  }

  return importKeyFromBase64(b64Key)
}

/**
 * Encrypt a medical answers record into a versioned ciphertext string.
 *
 * Format: v1:{base64(IV || ciphertext+authTag)}
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

  const b64 = btoa(String.fromCharCode(...combined))
  return `${CURRENT_VERSION}:${b64}`
}

/**
 * Decrypt a ciphertext string back into a medical answers record.
 * Supports versioned format (v1:...) and tries fallback keys for rotation.
 *
 * Throws if the key is wrong, the ciphertext is corrupted, or the auth tag is invalid.
 */
export async function decryptMedical(ciphertext: string): Promise<MedicalAnswers> {
  const versionMatch = ciphertext.match(VERSION_PREFIX_RE)

  if (versionMatch) {
    const version = `v${versionMatch[1]}`
    const payload = ciphertext.slice(version.length + 1) // skip "vN:"
    return decryptPayload(payload, version)
  }

  // No version prefix — legacy unversioned ciphertext
  return decryptPayload(ciphertext, null)
}

/**
 * Decrypt a base64-encoded payload (IV || ciphertext+authTag).
 * Tries the primary key first, then the version-specific fallback key if available.
 */
async function decryptPayload(
  b64Payload: string,
  version: string | null,
): Promise<MedicalAnswers> {
  const combined = Uint8Array.from(atob(b64Payload), (c) => c.charCodeAt(0))

  if (combined.length < IV_LENGTH + 1) {
    throw new Error('Ciphertext too short to contain IV and data')
  }

  const iv = combined.slice(0, IV_LENGTH)
  const encryptedData = combined.slice(IV_LENGTH)

  // Try primary key first
  const primaryKey = await importKey()
  try {
    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      primaryKey,
      encryptedData,
    )
    const json = new TextDecoder().decode(decrypted)
    return JSON.parse(json) as MedicalAnswers
  } catch (primaryError) {
    // If we have a version, try the fallback key for that version
    if (version) {
      const fallbackKey = await importFallbackKey(version)
      if (fallbackKey) {
        const decrypted = await globalThis.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          fallbackKey,
          encryptedData,
        )
        const json = new TextDecoder().decode(decrypted)
        return JSON.parse(json) as MedicalAnswers
      }
      // Fallback key not configured — old records will be inaccessible
      log.error('safeDecryptMedical: versioned ciphertext decryption failed and no fallback key configured', {
        version,
        hint: `Set MEDICAL_ENCRYPTION_KEY_${version.toUpperCase()} to the previous key for key rotation`,
      })
    }

    // No fallback available — re-throw the original error
    throw primaryError
  }
}

/**
 * Safe wrapper around decryptMedical that handles:
 * 1. Versioned ciphertext (v1:...) — decrypt, or log error and return {} on failure
 * 2. Unversioned plaintext JSON records (pre-encryption migration) — parse directly
 * 3. Unversioned encrypted records (legacy pre-version format) — attempt decrypt, then JSON.parse
 *
 * Key behavior: A versioned ciphertext that fails decryption NEVER falls through
 * to JSON.parse. Only unversioned values get the legacy JSON.parse fallback.
 *
 * Use this everywhere instead of bare decryptMedical in query/mutation handlers.
 */
export async function safeDecryptMedical(storedValue: string): Promise<MedicalAnswers> {
  const hasVersionPrefix = VERSION_PREFIX_RE.test(storedValue)

  if (hasVersionPrefix) {
    // Versioned ciphertext: decrypt or fail cleanly — no JSON.parse fallback
    try {
      return await decryptMedical(storedValue)
    } catch (e) {
      log.warn('safeDecryptMedical failed on versioned ciphertext — returning empty record', {
        error: e instanceof Error ? e.message : String(e),
      })
      return {}
    }
  }

  // Unversioned value: try decrypt first (legacy encrypted), then JSON.parse (legacy plaintext)
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
    log.warn('safeDecryptMedical: failed to decrypt legacy record', {
      error: e instanceof Error ? e.message : String(e),
      inputPrefix: storedValue.slice(0, 20),
    })
    return {}
  }
}
