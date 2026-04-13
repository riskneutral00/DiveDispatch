import { parse } from 'mrz'

export type PassportCapture = {
  surname: string | null
  givenNames: string | null
  documentNumber: string | null
  nationality: string | null
  issuingCountry: string | null
  dateOfBirth: string | null
  dateOfExpiry: string | null
  sex: 'M' | 'F' | 'X' | null
  valid: boolean
}

export function parsePassportMrz(input: string | string[]): PassportCapture | null {
  const lines = Array.isArray(input)
    ? input
    : input
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)

  if (lines.length < 2) return null

  const result = parse(lines)
  const f = result.fields

  return {
    surname: f.lastName ?? null,
    givenNames: f.firstName ?? null,
    documentNumber: f.documentNumber ?? null,
    nationality: f.nationality ?? null,
    issuingCountry: f.issuingState ?? null,
    dateOfBirth: expandMrzDate(f.birthDate, { futureBias: false }),
    dateOfExpiry: expandMrzDate(f.expirationDate, { futureBias: true }),
    sex: f.sex === 'M' || f.sex === 'F' || f.sex === 'X' ? f.sex : null,
    valid: result.valid,
  }
}

function expandMrzDate(
  yymmdd: string | null | undefined,
  { futureBias }: { futureBias: boolean },
): string | null {
  if (!yymmdd || !/^\d{6}$/.test(yymmdd)) return null
  const yy = Number(yymmdd.slice(0, 2))
  const mm = yymmdd.slice(2, 4)
  const dd = yymmdd.slice(4, 6)
  const currentYY = new Date().getUTCFullYear() % 100
  const century = futureBias
    ? yy < currentYY + 20
      ? 2000
      : 1900
    : yy <= currentYY
      ? 2000
      : 1900
  return `${century + yy}-${mm}-${dd}`
}
