// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePortalStep } from '../use-portal-step'
import { ConvexError } from 'convex/values'
import {
  TOKEN_EXPIRED_MESSAGE,
  BOOKING_CLOSED_MESSAGE,
  UNEXPECTED_ERROR_MESSAGE,
} from '@/lib/constants/error-messages'

// ── Error state management ──────────────────────────────────────────────────

describe('usePortalStep — error state', () => {
  it('starts with empty errors and null serverError', () => {
    const { result } = renderHook(() => usePortalStep())
    expect(result.current.errors).toEqual({})
    expect(result.current.serverError).toBeNull()
  })

  it('setFieldError sets a single field error', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => result.current.setFieldError('email', 'Required'))
    expect(result.current.errors).toEqual({ email: 'Required' })
  })

  it('clearError removes a single field error', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => {
      result.current.setFieldError('email', 'Required')
      result.current.setFieldError('phone', 'Invalid')
    })
    act(() => result.current.clearError('email'))
    expect(result.current.errors).toEqual({ phone: 'Invalid' })
  })

  it('clearError is a no-op for non-existent keys', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => result.current.setFieldError('email', 'Required'))
    const before = result.current.errors
    act(() => result.current.clearError('nonexistent'))
    // Should return same reference when key is not present
    expect(result.current.errors).toBe(before)
  })

  it('setErrors bulk-replaces all field errors', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => result.current.setFieldError('email', 'Required'))
    act(() =>
      result.current.setErrors({ phone: 'Invalid', name: 'Too short' }),
    )
    // Previous 'email' error is gone; only the new batch remains
    expect(result.current.errors).toEqual({ phone: 'Invalid', name: 'Too short' })
  })

  it('clearAllErrors resets all field errors', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => {
      result.current.setFieldError('email', 'Required')
      result.current.setFieldError('phone', 'Invalid')
    })
    act(() => result.current.clearAllErrors())
    expect(result.current.errors).toEqual({})
  })
})

// ── handleMutationError ─────────────────────────────────────────────────────

describe('usePortalStep — handleMutationError', () => {
  it('sets TOKEN_EXPIRED_MESSAGE for TOKEN_EXPIRED code', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() =>
      result.current.handleMutationError(
        new ConvexError({ code: 'TOKEN_EXPIRED' }),
      ),
    )
    expect(result.current.serverError).toBe(TOKEN_EXPIRED_MESSAGE)
  })

  it('sets BOOKING_CLOSED_MESSAGE for BOOKING_CLOSED code', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() =>
      result.current.handleMutationError(
        new ConvexError({ code: 'BOOKING_CLOSED' }),
      ),
    )
    expect(result.current.serverError).toBe(BOOKING_CLOSED_MESSAGE)
  })

  it('extracts code string from ConvexError with unknown code and no reason', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() =>
      result.current.handleMutationError(
        new ConvexError({ code: 'SOMETHING_ELSE' }),
      ),
    )
    // parseConvexError falls through reason → message → code
    expect(result.current.serverError).toBe('SOMETHING_ELSE')
  })

  it('falls back to UNEXPECTED_ERROR_MESSAGE for ConvexError with no fields', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() =>
      result.current.handleMutationError(new ConvexError({})),
    )
    expect(result.current.serverError).toBe(UNEXPECTED_ERROR_MESSAGE)
  })

  it('falls back to UNEXPECTED_ERROR_MESSAGE for non-ConvexError', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() =>
      result.current.handleMutationError(new Error('network down')),
    )
    expect(result.current.serverError).toBe(UNEXPECTED_ERROR_MESSAGE)
  })

  it('uses custom reason from ConvexError data when code is generic', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() =>
      result.current.handleMutationError(
        new ConvexError({ code: 'VALIDATION_ERROR', reason: 'Email already taken' }),
      ),
    )
    expect(result.current.serverError).toBe('Email already taken')
  })
})

// ── validateFields ──────────────────────────────────────────────────────────

describe('usePortalStep — validateFields', () => {
  it('returns true and sets no errors when all rules pass', () => {
    const { result } = renderHook(() => usePortalStep())
    const rules = {
      email: { test: (v: string) => v.includes('@'), message: 'Invalid email', value: 'a@b.com' },
      phone: { test: (v: string) => v.length > 0, message: 'Required', value: '+1234' },
    }
    let valid: boolean
    act(() => {
      valid = result.current.validateFields(rules)
    })
    expect(valid!).toBe(true)
    expect(result.current.errors).toEqual({})
  })

  it('returns false and sets errors for failing rules', () => {
    const { result } = renderHook(() => usePortalStep())
    const rules = {
      email: { test: (v: string) => v.includes('@'), message: 'Invalid email', value: 'bad' },
      phone: { test: (v: string) => v.length > 0, message: 'Required', value: '' },
    }
    let valid: boolean
    act(() => {
      valid = result.current.validateFields(rules)
    })
    expect(valid!).toBe(false)
    expect(result.current.errors).toEqual({
      email: 'Invalid email',
      phone: 'Required',
    })
  })

  it('clears previous errors on re-validation', () => {
    const { result } = renderHook(() => usePortalStep())
    // First validation: email fails
    act(() => {
      result.current.validateFields({
        email: { test: () => false, message: 'Bad', value: '' },
      })
    })
    expect(result.current.errors).toEqual({ email: 'Bad' })

    // Second validation: email passes
    act(() => {
      result.current.validateFields({
        email: { test: () => true, message: 'Bad', value: 'ok' },
      })
    })
    expect(result.current.errors).toEqual({})
  })
})

// ── submitting state ────────────────────────────────────────────────────────

describe('usePortalStep — submitting', () => {
  it('starts with submitting = false', () => {
    const { result } = renderHook(() => usePortalStep())
    expect(result.current.submitting).toBe(false)
  })

  it('setSubmitting toggles submitting state', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() => result.current.setSubmitting(true))
    expect(result.current.submitting).toBe(true)
    act(() => result.current.setSubmitting(false))
    expect(result.current.submitting).toBe(false)
  })
})

// ── clearServerError ────────────────────────────────────────────────────────

describe('usePortalStep — clearServerError', () => {
  it('clears a previously set serverError', () => {
    const { result } = renderHook(() => usePortalStep())
    act(() =>
      result.current.handleMutationError(
        new ConvexError({ code: 'TOKEN_EXPIRED' }),
      ),
    )
    expect(result.current.serverError).not.toBeNull()
    act(() => result.current.clearServerError())
    expect(result.current.serverError).toBeNull()
  })
})
