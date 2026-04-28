// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ConvexError } from 'convex/values'

const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: (msg: string, opts?: unknown) => toastSuccess(msg, opts),
    error: (msg: string, opts?: unknown) => toastError(msg, opts),
  },
}))

import { useMutationWithFeedback } from '../use-mutation-with-feedback'

describe('useMutationWithFeedback', () => {
  beforeEach(() => {
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  it('returns ok=true and shows success toast when mutation resolves', async () => {
    const fn = vi.fn(async (n: number) => n + 1)
    const { result } = renderHook(() =>
      useMutationWithFeedback(fn, { successMessage: 'Saved' }),
    )

    let value: { ok: boolean; value?: number } | undefined
    await act(async () => {
      const res = await result.current.execute(1)
      if (res.ok) value = { ok: res.ok, value: res.value }
    })

    expect(value?.ok).toBe(true)
    expect(value?.value).toBe(2)
    expect(toastSuccess).toHaveBeenCalledWith('Saved', { duration: 3000 })
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('returns ok=false and parses ConvexError reason via parseConvexError', async () => {
    const fn = vi.fn(async () => {
      throw new ConvexError({ code: 'VALIDATION', reason: 'name required' })
    })
    const { result } = renderHook(() => useMutationWithFeedback(fn))

    let res: { ok: boolean; error?: string } | undefined
    await act(async () => {
      const r = await result.current.execute()
      if (!r.ok) res = { ok: r.ok, error: r.error }
    })

    expect(res?.ok).toBe(false)
    expect(res?.error).toBe('name required')
    expect(toastError).toHaveBeenCalledWith('name required', { duration: 5000 })
    expect(result.current.error).toBe('name required')
  })

  it('falls back to errorFallback when error is unparseable (non-ConvexError)', async () => {
    const fn = vi.fn(async () => {
      throw new Error('plain error')
    })
    const { result } = renderHook(() =>
      useMutationWithFeedback(fn, { errorFallback: 'Save failed' }),
    )

    await act(async () => {
      await result.current.execute()
    })

    expect(result.current.error).toBe('Save failed')
  })

  it('uses translateError callback when provided to map errors', async () => {
    const translate = vi.fn(() => 'Translated message')
    const fn = vi.fn(async () => {
      throw new Error('raw error')
    })
    const { result } = renderHook(() =>
      useMutationWithFeedback(fn, { translateError: translate }),
    )

    await act(async () => {
      await result.current.execute()
    })

    expect(translate).toHaveBeenCalledWith(expect.any(Error))
    expect(result.current.error).toBe('Translated message')
    expect(toastError).toHaveBeenCalledWith('Translated message', { duration: 5000 })
  })

  it('clearError resets the error state', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom')
    })
    const { result } = renderHook(() => useMutationWithFeedback(fn))

    await act(async () => {
      await result.current.execute()
    })
    expect(result.current.error).not.toBeNull()

    act(() => result.current.clearError())
    expect(result.current.error).toBeNull()
  })

  it('uses errorFallback when no translateError is provided and error is unparseable', async () => {
    const fn = vi.fn(async () => {
      throw 'raw string'
    })
    const { result } = renderHook(() =>
      useMutationWithFeedback(fn, { errorFallback: 'Fallback message' }),
    )

    await act(async () => {
      await result.current.execute()
    })

    expect(result.current.error).toContain('Fallback message')
  })
})
