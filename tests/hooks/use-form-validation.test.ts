// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { z } from 'zod'
import { useFormValidation } from '../../src/lib/validation/useFormValidation'

const testSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  age: z.number().min(18, 'Must be 18 or older'),
})

describe('useFormValidation', () => {
  it('starts with empty errors', () => {
    const { result } = renderHook(() => useFormValidation(testSchema))
    expect(result.current.errors).toEqual({})
  })

  it('returns success for valid data', () => {
    const { result } = renderHook(() => useFormValidation(testSchema))
    let res: ReturnType<typeof result.current.validate>
    act(() => {
      res = result.current.validate({ name: 'John', email: 'john@test.com', age: 25 })
    })
    expect(res!.success).toBe(true)
    expect(res!.data).toEqual({ name: 'John', email: 'john@test.com', age: 25 })
    expect(result.current.errors).toEqual({})
  })

  it('returns errors for invalid data', () => {
    const { result } = renderHook(() => useFormValidation(testSchema))
    let res: ReturnType<typeof result.current.validate>
    act(() => {
      res = result.current.validate({ name: '', email: 'bad', age: 15 })
    })
    expect(res!.success).toBe(false)
    expect(res!.errors).toBeDefined()
    expect(res!.errors!.name).toBe('Name is required')
    expect(res!.errors!.email).toBe('Invalid email')
    expect(res!.errors!.age).toBe('Must be 18 or older')
    expect(result.current.errors).toEqual(res!.errors)
  })

  it('clearError removes a single field error', () => {
    const { result } = renderHook(() => useFormValidation(testSchema))
    act(() => { result.current.validate({ name: '', email: 'bad', age: 15 }) })
    expect(Object.keys(result.current.errors)).toHaveLength(3)

    act(() => { result.current.clearError('name') })
    expect(result.current.errors.name).toBeUndefined()
    expect(result.current.errors.email).toBeDefined()
    expect(result.current.errors.age).toBeDefined()
  })

  it('clearError is no-op for non-existent field', () => {
    const { result } = renderHook(() => useFormValidation(testSchema))
    act(() => { result.current.validate({ name: '', email: 'bad', age: 15 }) })
    const before = { ...result.current.errors }
    act(() => { result.current.clearError('nonexistent') })
    expect(result.current.errors).toEqual(before)
  })

  it('clearAllErrors removes all errors', () => {
    const { result } = renderHook(() => useFormValidation(testSchema))
    act(() => { result.current.validate({ name: '', email: 'bad', age: 15 }) })
    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0)

    act(() => { result.current.clearAllErrors() })
    expect(result.current.errors).toEqual({})
  })

  it('successful validation clears previous errors', () => {
    const { result } = renderHook(() => useFormValidation(testSchema))
    act(() => { result.current.validate({ name: '', email: 'bad', age: 15 }) })
    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0)

    act(() => { result.current.validate({ name: 'Valid', email: 'a@b.com', age: 20 }) })
    expect(result.current.errors).toEqual({})
  })

  it('keeps only first error per field for multiple issues on same path', () => {
    const strictSchema = z.object({
      password: z.string().min(8, 'Too short').regex(/[A-Z]/, 'Need uppercase'),
    })
    const { result } = renderHook(() => useFormValidation(strictSchema))
    let res: ReturnType<typeof result.current.validate>
    act(() => { res = result.current.validate({ password: 'a' }) })
    // Should only show first error for password
    expect(res!.errors!.password).toBe('Too short')
  })

  it('handles nested path errors with dot notation', () => {
    const nestedSchema = z.object({
      contact: z.object({
        phone: z.string().min(1, 'Phone required'),
      }),
    })
    const { result } = renderHook(() => useFormValidation(nestedSchema))
    let res: ReturnType<typeof result.current.validate>
    act(() => { res = result.current.validate({ contact: { phone: '' } }) })
    expect(res!.errors!['contact.phone']).toBe('Phone required')
  })
})
