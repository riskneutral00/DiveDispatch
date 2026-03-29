/**
 * Test helpers for medical data encryption.
 *
 * These wrap the production encrypt/decrypt functions and are used by test fixtures
 * that need to seed encrypted medical answers into the DB.
 */

import { encryptMedical, decryptMedical, safeDecryptMedical } from '../../convex/lib/crypto'

export type MedicalRecord = Record<string, boolean | string>

/** Encrypt medical answers for use in seed fixtures. Requires MEDICAL_ENCRYPTION_KEY env var (set in vitest.setup.ts). */
export async function encryptMedicalForTest(data: MedicalRecord): Promise<string> {
  return encryptMedical(data)
}

/** Decrypt medical answers from DB for test assertions. */
export async function decryptMedicalForTest(ciphertext: string): Promise<MedicalRecord> {
  return decryptMedical(ciphertext)
}

/** Safe decrypt — handles legacy plaintext and corrupt data. For test assertions. */
export async function safeDecryptMedicalForTest(storedValue: string): Promise<MedicalRecord> {
  return safeDecryptMedical(storedValue)
}
