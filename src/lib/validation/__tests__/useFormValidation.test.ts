// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { z } from 'zod'
import { useFormValidation } from '../useFormValidation'

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Invalid email'),
})

describe('useFormValidation validateField (on-blur)', () => {
  it('does NOT surface error when field is untouched', () => {
    const { result } = renderHook(() => useFormValidation(schema))
    act(() => { result.current.validateField('name', { name: '', email: 'a@b.com' }) })
    expect(result.current.errors.name).toBe('Name required')
  })

  it('surfaces error on blur of an invalid touched field', () => {
    const { result } = renderHook(() => useFormValidation(schema))
    act(() => { result.current.markTouched('email') })
    act(() => { result.current.validateField('email', { name: '', email: 'bad' }) })
    expect(result.current.errors.email).toBe('Invalid email')
  })

  it('clears error when touched field becomes valid', () => {
    const { result } = renderHook(() => useFormValidation(schema))
    act(() => { result.current.validateField('email', { name: '', email: 'bad' }) })
    expect(result.current.errors.email).toBe('Invalid email')
    act(() => { result.current.validateField('email', { name: '', email: 'good@x.com' }) })
    expect(result.current.errors.email).toBeUndefined()
  })

  it('cross-field sweep clears stale superRefine error after sibling fix', () => {
    const refineSchema = z
      .object({ a: z.string(), b: z.string() })
      .superRefine((d, ctx) => {
        if (d.a && d.b && d.a === d.b) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must differ', path: ['b'] })
        }
      })
    const { result } = renderHook(() => useFormValidation(refineSchema))
    act(() => { result.current.markTouched('a') })
    act(() => { result.current.validateField('b', { a: 'x', b: 'x' }) })
    expect(result.current.errors.b).toBe('must differ')
    act(() => { result.current.validateField('a', { a: 'y', b: 'x' }) })
    expect(result.current.errors.b).toBeUndefined()
  })

  it('cross-field sweep preserves errors._form (reserved key)', () => {
    const refineSchema = z
      .object({ name: z.string(), email: z.string().email() })
      .superRefine((d, ctx) => {
        if (d.name === '__BAD__') {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Form-level issue', path: ['_form'] })
        }
      })
    const { result } = renderHook(() => useFormValidation(refineSchema))
    act(() => { result.current.validate({ name: '__BAD__', email: 'good@x.com' }) })
    expect(result.current.errors._form).toBe('Form-level issue')
    act(() => { result.current.validateField('email', { name: '__BAD__', email: 'good@x.com' }) })
    expect(result.current.errors._form).toBe('Form-level issue')
  })

  it('composite path: validateField(parent) catches parent.child issue', () => {
    const compositeSchema = z.object({
      location: z.object({
        address: z.object({ street: z.string().min(1, 'Street required') }),
      }),
    })
    const { result } = renderHook(() => useFormValidation(compositeSchema))
    act(() => {
      result.current.validateField('location', {
        location: { address: { street: '' } },
      })
    })
    expect(result.current.errors.location).toBe('Street required')
  })

  it('clearAllErrors resets touched (so silent fields stay silent on next blur)', () => {
    const { result } = renderHook(() => useFormValidation(schema))
    act(() => { result.current.validateField('email', { name: '', email: 'bad' }) })
    expect(result.current.errors.email).toBe('Invalid email')
    act(() => { result.current.clearAllErrors() })
    act(() => { result.current.validateField('name', { name: '', email: 'bad' }) })
    expect(result.current.errors.email).toBeUndefined()
  })

  it('validate() at submit time surfaces all errors regardless of touched', () => {
    const { result } = renderHook(() => useFormValidation(schema))
    act(() => { result.current.validate({ name: '', email: 'bad' }) })
    expect(result.current.errors.name).toBe('Name required')
    expect(result.current.errors.email).toBe('Invalid email')
  })
})
