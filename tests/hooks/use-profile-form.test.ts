// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { z } from 'zod'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { useProfileForm, type UseProfileFormOptions } from '../../src/lib/hooks/use-profile-form'

const testSchema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Invalid email'),
})

type TestForm = { name: string; email: string }
type TestPayload = { name: string; email: string }

function makeOptions(overrides?: Partial<UseProfileFormOptions<TestForm, TestPayload>>): UseProfileFormOptions<TestForm, TestPayload> {
  return {
    profile: undefined,
    schema: testSchema,
    defaults: { name: '', email: '' },
    fromProfile: (p) => ({ name: String(p.name ?? ''), email: String(p.email ?? '') }),
    toPayload: (f) => f,
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('useProfileForm', () => {
  it('starts in loading state when profile is undefined', () => {
    const { result } = renderHook(() => useProfileForm(makeOptions()))
    expect(result.current.loading).toBe(true)
    expect(result.current.isUpdate).toBe(false)
  })

  it('initializes from profile when profile loads', () => {
    const opts = makeOptions({ profile: { name: 'Test', email: 'a@b.com' } })
    const { result } = renderHook(() => useProfileForm(opts))
    expect(result.current.form).toEqual({ name: 'Test', email: 'a@b.com' })
    expect(result.current.loading).toBe(false)
    expect(result.current.isUpdate).toBe(true)
  })

  it('uses defaults when profile is null (new profile)', () => {
    const opts = makeOptions({ profile: null })
    const { result } = renderHook(() => useProfileForm(opts))
    expect(result.current.form).toEqual({ name: '', email: '' })
    expect(result.current.isUpdate).toBe(false)
  })

  it('pre-fills from me when no profile exists and fromMe is provided', () => {
    const opts = makeOptions({
      profile: null,
      me: { businessName: 'My Biz', email: 'me@test.com' },
      fromMe: (me, defs) => ({ ...defs, name: me.businessName ?? '', email: me.email ?? '' }),
    })
    const { result } = renderHook(() => useProfileForm(opts))
    expect(result.current.form.name).toBe('My Biz')
    expect(result.current.form.email).toBe('me@test.com')
  })

  it('setField updates a field and clears its error', () => {
    const opts = makeOptions({ profile: null })
    const { result } = renderHook(() => useProfileForm(opts))

    // Trigger validation to get errors
    act(() => {
      const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
      result.current.handleSubmit(fakeEvent)
    })

    // name should have an error
    expect(result.current.errors.name).toBe('Name required')

    // Set field clears the error
    act(() => { result.current.setField('name', 'Updated') })
    expect(result.current.form.name).toBe('Updated')
    expect(result.current.errors.name).toBeUndefined()
  })

  it('isValid tracks schema compliance', () => {
    const opts = makeOptions({ profile: null })
    const { result } = renderHook(() => useProfileForm(opts))
    expect(result.current.isValid).toBe(false) // defaults fail validation

    act(() => { result.current.setField('name', 'Valid') })
    act(() => { result.current.setField('email', 'valid@test.com') })
    expect(result.current.isValid).toBe(true)
  })

  it('isDirty detects changes from baseline', () => {
    const opts = makeOptions({ profile: { name: 'Original', email: 'orig@test.com' } })
    const { result } = renderHook(() => useProfileForm(opts))
    expect(result.current.isDirty).toBe(false)

    act(() => { result.current.setField('name', 'Changed') })
    expect(result.current.isDirty).toBe(true)
  })

  it('handleSubmit validates before saving', async () => {
    const createMock = vi.fn().mockResolvedValue(undefined)
    const opts = makeOptions({ profile: null, create: createMock })
    const { result } = renderHook(() => useProfileForm(opts))
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent

    await act(async () => { await result.current.handleSubmit(fakeEvent) })

    expect(createMock).not.toHaveBeenCalled()
    expect(result.current.errors.name).toBe('Name required')
    expect(result.current.errors.email).toBe('Invalid email')
  })

  it('handleSubmit calls create for new profile', async () => {
    const createMock = vi.fn().mockResolvedValue(undefined)
    const opts = makeOptions({ profile: null, create: createMock })
    const { result } = renderHook(() => useProfileForm(opts))

    act(() => { result.current.setField('name', 'New') })
    act(() => { result.current.setField('email', 'new@test.com') })

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => { await result.current.handleSubmit(fakeEvent) })

    expect(createMock).toHaveBeenCalledWith({ name: 'New', email: 'new@test.com' })
    expect(result.current.saved).toBe(true)
    expect(result.current.saving).toBe(false)
  })

  it('calls afterSuccessfulSave after successful create', async () => {
    const afterSave = vi.fn().mockResolvedValue(undefined)
    const createMock = vi.fn().mockResolvedValue(undefined)
    const opts = makeOptions({ profile: null, create: createMock, afterSuccessfulSave: afterSave })
    const { result } = renderHook(() => useProfileForm(opts))

    act(() => { result.current.setField('name', 'New') })
    act(() => { result.current.setField('email', 'new@test.com') })

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => { await result.current.handleSubmit(fakeEvent) })

    expect(afterSave).toHaveBeenCalledWith({ name: 'New', email: 'new@test.com' })
  })

  it('stays loading when waitForMeBeforeInit and me is still undefined', () => {
    const opts = makeOptions({
      profile: null,
      waitForMeBeforeInit: true,
      me: undefined,
    })
    const { result } = renderHook(() => useProfileForm(opts))
    expect(result.current.loading).toBe(true)
  })

  it('handleSubmit calls update for existing profile', async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined)
    const opts = makeOptions({
      profile: { name: 'Existing', email: 'e@test.com' },
      update: updateMock,
    })
    const { result } = renderHook(() => useProfileForm(opts))

    act(() => { result.current.setField('name', 'Updated') })

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => { await result.current.handleSubmit(fakeEvent) })

    expect(updateMock).toHaveBeenCalledWith({ name: 'Updated', email: 'e@test.com' })
    expect(result.current.saved).toBe(true)
  })

  it('handleSubmit captures server error on mutation failure', async () => {
    const { ConvexError } = await import('convex/values')
    const createMock = vi.fn().mockRejectedValue(new ConvexError({ reason: 'Duplicate name' }))
    const opts = makeOptions({ profile: null, create: createMock })
    const { result } = renderHook(() => useProfileForm(opts))

    act(() => { result.current.setField('name', 'Dup') })
    act(() => { result.current.setField('email', 'dup@test.com') })

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => { await result.current.handleSubmit(fakeEvent) })

    expect(result.current.serverError).toBe('Duplicate name')
    expect(result.current.saving).toBe(false)
    expect(result.current.saved).toBe(false)
  })

  it('isDirty resets to false after successful save', async () => {
    const createMock = vi.fn().mockResolvedValue(undefined)
    const opts = makeOptions({ profile: null, create: createMock })
    const { result } = renderHook(() => useProfileForm(opts))

    act(() => { result.current.setField('name', 'New') })
    act(() => { result.current.setField('email', 'new@test.com') })
    expect(result.current.isDirty).toBe(true)

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => { await result.current.handleSubmit(fakeEvent) })

    expect(result.current.isDirty).toBe(false)
  })
})
