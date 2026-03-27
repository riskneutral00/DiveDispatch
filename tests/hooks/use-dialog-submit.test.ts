// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDialogSubmit } from '../../src/lib/hooks/use-dialog-submit'

describe('useDialogSubmit', () => {
  it('starts with idle state', () => {
    const { result } = renderHook(() => useDialogSubmit())
    expect(result.current.submitting).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('runSubmit calls action and resets submitting', async () => {
    const { result } = renderHook(() => useDialogSubmit())
    const action = vi.fn().mockResolvedValue(undefined)
    await act(async () => {
      await result.current.runSubmit(action)
    })
    expect(action).toHaveBeenCalledOnce()
    expect(result.current.submitting).toBe(false)
  })

  it('runSubmit captures error on throw', async () => {
    const { result } = renderHook(() => useDialogSubmit())
    await act(async () => {
      await result.current.runSubmit(async () => {
        throw new Error('failed')
      })
    })
    expect(result.current.error).toBe('failed')
    expect(result.current.submitting).toBe(false)
  })

  it('runSubmit clears previous error on success', async () => {
    const { result } = renderHook(() => useDialogSubmit())
    await act(async () => {
      await result.current.runSubmit(async () => { throw new Error('err') })
    })
    expect(result.current.error).toBe('err')
    await act(async () => {
      await result.current.runSubmit(async () => {})
    })
    expect(result.current.error).toBeNull()
  })

  it('safeClose blocks close during submission', async () => {
    const { result } = renderHook(() => useDialogSubmit())
    const closeFn = vi.fn()

    // Start a submission that we control
    let resolveAction: () => void = () => {}
    const actionPromise = act(async () => {
      await result.current.runSubmit(() => new Promise<void>((r) => { resolveAction = r }))
    })

    // While submitting, safeClose should block
    act(() => {
      result.current.safeClose(closeFn)()
    })
    expect(closeFn).not.toHaveBeenCalled()

    // Resolve the action
    await act(async () => {
      resolveAction()
    })
    await actionPromise

    // After done, safeClose should call onClose
    act(() => {
      result.current.safeClose(closeFn)()
    })
    expect(closeFn).toHaveBeenCalledOnce()
  })

  it('safeClose clears error when closing', () => {
    const { result } = renderHook(() => useDialogSubmit())
    const closeFn = vi.fn()
    act(() => result.current.setError('some error'))
    expect(result.current.error).toBe('some error')
    act(() => result.current.safeClose(closeFn)())
    expect(result.current.error).toBeNull()
    expect(closeFn).toHaveBeenCalledOnce()
  })

  it('handles non-Error throws with fallback message', async () => {
    const { result } = renderHook(() => useDialogSubmit())
    await act(async () => {
      await result.current.runSubmit(async () => { throw 42 })
    })
    expect(result.current.error).toBe('An unexpected error occurred.')
  })
})
