import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { ConvexError } from 'convex/values'
import { assertZodSchema } from '../../convex/lib/validate'

describe('assertZodSchema', () => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    age: z.number().int().min(0),
  })

  it('returns parsed data for valid input', () => {
    const result = assertZodSchema(schema, { name: 'Alice', age: 30 })
    expect(result).toEqual({ name: 'Alice', age: 30 })
  })

  it('strips unknown fields via parse', () => {
    const result = assertZodSchema(schema, { name: 'Bob', age: 25, extra: true })
    expect(result).toEqual({ name: 'Bob', age: 25 })
    expect(result).not.toHaveProperty('extra')
  })

  it('throws ConvexError with VALIDATION code on invalid input', () => {
    try {
      assertZodSchema(schema, { name: '', age: 30 })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError)
      const data = (err as ConvexError<{ code: string }>).data
      expect(data.code).toBe('VALIDATION')
    }
  })

  it('includes field path in the error data', () => {
    try {
      assertZodSchema(schema, { name: 'Alice', age: -1 })
      expect.fail('should have thrown')
    } catch (err) {
      const data = (err as ConvexError<{ field: string }>).data
      expect(data.field).toBe('age')
    }
  })

  it('includes reason string in the error data', () => {
    try {
      assertZodSchema(schema, { name: '', age: 30 })
      expect.fail('should have thrown')
    } catch (err) {
      const data = (err as ConvexError<{ reason: string }>).data
      expect(data.reason).toBe('Name is required')
    }
  })

  it('handles nested field paths', () => {
    const nested = z.object({
      address: z.object({
        city: z.string().min(1, 'City required'),
      }),
    })
    try {
      assertZodSchema(nested, { address: { city: '' } })
      expect.fail('should have thrown')
    } catch (err) {
      const data = (err as ConvexError<{ field: string }>).data
      expect(data.field).toBe('address.city')
    }
  })

  it('throws on completely wrong type (string instead of object)', () => {
    expect(() => assertZodSchema(schema, 'not an object')).toThrow(ConvexError)
  })

  it('throws on null input', () => {
    expect(() => assertZodSchema(schema, null)).toThrow(ConvexError)
  })

  it('throws on undefined input', () => {
    expect(() => assertZodSchema(schema, undefined)).toThrow(ConvexError)
  })
})
