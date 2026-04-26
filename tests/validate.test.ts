import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { ConvexError } from 'convex/values'
import { assertZodSchema } from '../convex/lib/validate'
import { ErrorCode } from '../convex/lib/errorCodes'

const personSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().int().positive('Age must be positive'),
  address: z.object({
    city: z.string().min(1),
    zip: z.string().regex(/^\d{5}$/, 'Must be 5 digits'),
  }).optional(),
})

describe('assertZodSchema', () => {
  it('returns parsed data on valid input', () => {
    const result = assertZodSchema(personSchema, { name: 'Alice', age: 30 })
    expect(result).toEqual({ name: 'Alice', age: 30 })
  })

  it('strips unknown fields via Zod defaults', () => {
    const result = assertZodSchema(personSchema, { name: 'Bob', age: 25, extra: true })
    expect(result).toEqual({ name: 'Bob', age: 25 })
    expect((result as Record<string, unknown>).extra).toBeUndefined()
  })

  it('throws ConvexError on missing required field', () => {
    try {
      assertZodSchema(personSchema, { age: 30 })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError)
      const data = (err as ConvexError<{ code: string; field: string; reason: string }>).data
      expect(data.code).toBe(ErrorCode.VALIDATION)
      expect(data.field).toBe('name')
    }
  })

  it('throws ConvexError with reason on invalid type', () => {
    try {
      assertZodSchema(personSchema, { name: 'Alice', age: 'thirty' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError)
      const data = (err as ConvexError<{ code: string; field: string; reason: string }>).data
      expect(data.code).toBe(ErrorCode.VALIDATION)
      expect(data.field).toBe('age')
      expect(typeof data.reason).toBe('string')
      expect(data.reason.length).toBeGreaterThan(0)
    }
  })

  it('reports nested path with dot notation', () => {
    try {
      assertZodSchema(personSchema, {
        name: 'Alice',
        age: 30,
        address: { city: 'NYC', zip: 'bad' },
      })
      expect.fail('should have thrown')
    } catch (err) {
      const data = (err as ConvexError<{ field: string; reason: string }>).data
      expect(data.field).toBe('address.zip')
      expect(data.reason).toBe('Must be 5 digits')
    }
  })

  it('reports only the first issue', () => {
    try {
      // Both name and age are invalid
      assertZodSchema(personSchema, { name: '', age: -5 })
      expect.fail('should have thrown')
    } catch (err) {
      const data = (err as ConvexError<{ field: string }>).data
      // Should be a single field, not both
      expect(typeof data.field).toBe('string')
    }
  })

  it('works with simple schemas', () => {
    const emailSchema = z.string().email()
    expect(assertZodSchema(emailSchema, 'test@example.com')).toBe('test@example.com')
  })

  it('throws for simple schema violations', () => {
    const emailSchema = z.string().email()
    try {
      assertZodSchema(emailSchema, 'not-an-email')
      expect.fail('should have thrown')
    } catch (err) {
      const data = (err as ConvexError<{ code: string; field: string }>).data
      expect(data.code).toBe(ErrorCode.VALIDATION)
      // Root-level schema → empty path
      expect(data.field).toBe('')
    }
  })
})
