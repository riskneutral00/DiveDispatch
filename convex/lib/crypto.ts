import { log } from './logger'

type MedicalAnswers = Record<string, boolean | string>

const IV_LENGTH = 12
const CURRENT_VERSION = 'v1'
const VERSION_PREFIX_RE = /^v(\d+):/

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

async function importFallbackKey(version: string): Promise<CryptoKey | null> {
  const envVar = `MEDICAL_ENCRYPTION_KEY_${version.toUpperCase()}`
  const b64Key = process.env[envVar]
  if (!b64Key) {
    return null
  }

  return importKeyFromBase64(b64Key)
}

export async function encryptMedical(data: MedicalAnswers): Promise<string> {
  const key = await importKey()
  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  )

  const combined = new Uint8Array(IV_LENGTH + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), IV_LENGTH)

  const b64 = btoa(String.fromCharCode(...combined))
  return `${CURRENT_VERSION}:${b64}`
}

export async function decryptMedical(ciphertext: string): Promise<MedicalAnswers> {
  const versionMatch = ciphertext.match(VERSION_PREFIX_RE)

  if (versionMatch) {
    const version = `v${versionMatch[1]}`
    const payload = ciphertext.slice(version.length + 1) // skip "vN:"
    return decryptPayload(payload, version)
  }

  return decryptPayload(ciphertext, null)
}

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
      log.error('safeDecryptMedical: versioned ciphertext decryption failed and no fallback key configured', {
        version,
        hint: `Set MEDICAL_ENCRYPTION_KEY_${version.toUpperCase()} to the previous key for key rotation`,
      })
    }

    throw primaryError
  }
}

export async function safeDecryptMedical(storedValue: string): Promise<MedicalAnswers> {
  const hasVersionPrefix = VERSION_PREFIX_RE.test(storedValue)

  if (hasVersionPrefix) {
    try {
      return await decryptMedical(storedValue)
    } catch (e) {
      log.warn('safeDecryptMedical failed on versioned ciphertext — returning empty record', {
        error: e instanceof Error ? e.message : String(e),
      })
      return {}
    }
  }

  try {
    return await decryptMedical(storedValue)
  } catch (e) {
    try {
      const parsed = JSON.parse(storedValue)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as MedicalAnswers
      }
    } catch {
    }
    log.warn('safeDecryptMedical: failed to decrypt legacy record', {
      error: e instanceof Error ? e.message : String(e),
      inputPrefix: storedValue.slice(0, 20),
    })
    return {}
  }
}
