// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ConvexError } from 'convex/values'
import { usePortalStep } from '../../src/lib/hooks/use-portal-step'

describe('usePortalStep', () => {
  // ── Initial state ──────────────────────────────────────────────────
  it('starts with empty errors and no server error', () => {
    const { result } = renderHook(() => usePortalStep())
    expect(result.current.errors).toEqual({})
    expect(result.current.serverError).toBeNull()
    expect(result.current.submitting).toBe(false)
  })

  // ── Field errors ──────────────────────────────────────────────────
  it('setFieldError adds a field error', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => { result.current.setFieldError('email', 'Invalid email') })
    expect(result.current.errors.email).toBe('Invalid email')
  })

  it('setFieldError overwrites existing field error', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => { result.current.setFieldError('email', 'First') })
    act(() => { result.current.setFieldError('email', 'Second') })
    expect(result.current.errors.email).toBe('Second')
  })

  it('clearError removes a single field error', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => { result.current.setFieldError('name', 'Required') })
    act(() => { result.current.setFieldError('email', 'Invalid') })
    act(() => { result.current.clearError('name') })
    expect(result.current.errors.name).toBeUndefined()
    expect(result.current.errors.email).toBe('Invalid')
  })

  it('clearError is no-op for non-existent field', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => { result.current.setFieldError('name', 'Required') })
    const before = { ...result.current.errors }
    act(() => { result.current.clearError('nonexistent') })
    expect(result.current.errors).toEqual(before)
  })

  it('setErrors bulk-replaces all errors', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => { result.current.setFieldError('old', 'old error') })
    act(() => { result.current.setErrors({ name: 'required', email: 'invalid' }) })
    expect(result.current.errors).toEqual({ name: 'required', email: 'invalid' })
    expect(result.current.errors.old).toBeUndefined()
  })

  it('clearAllErrors removes all errors', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => { result.current.setErrors({ a: 'err1', b: 'err2' }) })
    act(() => { result.current.clearAllErrors() })
    expect(result.current.errors).toEqual({})
  })

  // ── Server error ──────────────────────────────────────────────────
  it('handleMutationError sets TOKEN_EXPIRED message', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => {
      result.current.handleMutationError(new ConvexError({ code: 'TOKEN_EXPIRED' }))
    })
    expect(result.current.serverError).toContain('expired')
  })

  it('handleMutationError sets BOOKING_CLOSED message', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => {
      result.current.handleMutationError(new ConvexError({ code: 'BOOKING_CLOSED' }))
    })
    expect(result.current.serverError).toBeTruthy()
  })

  it('handleMutationError uses reason for generic ConvexError', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => {
      result.current.handleMutationError(new ConvexError({ reason: 'Custom reason' }))
    })
    expect(result.current.serverError).toBe('Custom reason')
  })

  it('handleMutationError falls back for non-ConvexError', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => {
      result.current.handleMutationError(new Error('random'))
    })
    expect(result.current.serverError).toBeTruthy()
  })

  it('clearServerError clears the server error', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => {
      result.current.handleMutationError(new ConvexError({ reason: 'err' }))
    })
    expect(result.current.serverError).toBeTruthy()
    act(() => { result.current.clearServerError() })
    expect(result.current.serverError).toBeNull()
  })

  // ── Submission lifecycle ──────────────────────────────────────────
  it('setSubmitting toggles submitting state', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => { result.current.setSubmitting(true) })
    expect(result.current.submitting).toBe(true)
    act(() => { result.current.setSubmitting(false) })
    expect(result.current.submitting).toBe(false)
  })

  // ── Declarative validation ────────────────────────────────────────
  it('validateFields returns true when all rules pass', () => {
    const { result } = renderHook(() => usePortalStep())
    let valid: boolean
    act(() => {
      valid = result.current.validateFields({
        name: { test: (v) => v.length > 0, message: 'Required', value: 'John' },
        email: { test: (v) => v.includes('@'), message: 'Invalid', value: 'a@b.com' },
      })
    })
    expect(valid!).toBe(true)
    expect(result.current.errors).toEqual({})
  })

  it('validateFields returns false and sets errors when rules fail', () => {
    const { result } = renderHook(() => usePortalStep())
    let valid: boolean
    act(() => {
      valid = result.current.validateFields({
        name: { test: (v) => v.length > 0, message: 'Name required', value: '' },
        email: { test: (v) => v.includes('@'), message: 'Invalid email', value: 'bad' },
      })
    })
    expect(valid!).toBe(false)
    expect(result.current.errors.name).toBe('Name required')
    expect(result.current.errors.email).toBe('Invalid email')
  })

  it('validateFields clears previous errors on re-validation', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => {
      result.current.validateFields({
        name: { test: (v) => v.length > 0, message: 'Required', value: '' },
      })
    })
    expect(result.current.errors.name).toBe('Required')

    act(() => {
      result.current.validateFields({
        name: { test: (v) => v.length > 0, message: 'Required', value: 'OK' },
      })
    })
    expect(result.current.errors).toEqual({})
  })

  it('validateFields replaces all errors (not additive)', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => { result.current.setFieldError('oldField', 'old error') })
    act(() => {
      result.current.validateFields({
        newField: { test: () => false, message: 'new', value: '' },
      })
    })
    expect(result.current.errors.oldField).toBeUndefined()
    expect(result.current.errors.newField).toBe('new')
  })
})
