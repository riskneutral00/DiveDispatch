// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormStep } from '../../src/lib/hooks/use-form-step'

describe('useFormStep', () => {
  it('starts with idle state', () => {
    const { result } = renderHook(() => useFormStep())
    expect(result.current.saving).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.initialized).toBe(false)
  })

  it('setInitialized flips to true', () => {
    const { result } = renderHook(() => useFormStep())
    act(() => result.current.setInitialized())
    expect(result.current.initialized).toBe(true)
  })

  it('runSave resets saving to false after success', async () => {
    const { result } = renderHook(() => useFormStep())
    const action = vi.fn().mockResolvedValue(undefined)
    await act(async () => {
      await result.current.runSave(action)
    })
    expect(action).toHaveBeenCalledOnce()
    expect(result.current.saving).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('runSave captures error on throw', async () => {
    const { result } = renderHook(() => useFormStep())
    await act(async () => {
      await result.current.runSave(async () => {
        throw new Error('boom')
      })
    })
    expect(result.current.error).toBe('boom')
    expect(result.current.saving).toBe(false)
  })

  it('runSave clears previous error on success', async () => {
    const { result } = renderHook(() => useFormStep())
    // First: fail
    await act(async () => {
      await result.current.runSave(async () => { throw new Error('first') })
    })
    expect(result.current.error).toBe('first')
    // Second: succeed
    await act(async () => {
      await result.current.runSave(async () => {})
    })
    expect(result.current.error).toBeNull()
  })

  it('runSave handles non-Error throws with fallback message', async () => {
    const { result } = renderHook(() => useFormStep())
    await act(async () => {
      await result.current.runSave(async () => {
        throw 'string error'
      })
    })
    expect(result.current.error).toBe('Save failed')
  })
})
